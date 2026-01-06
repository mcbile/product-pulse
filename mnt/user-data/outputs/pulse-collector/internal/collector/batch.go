package collector

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kaasino/pulse-collector/internal/model"
	"github.com/kaasino/pulse-collector/internal/storage"
)

type BatchConfig struct {
	BatchSize     int
	FlushInterval time.Duration
	Workers       int
}

type Storage interface {
	InsertFrontendMetrics(ctx context.Context, events []model.EnrichedEvent) error
	CopyFrontendMetrics(ctx context.Context, events []model.EnrichedEvent) error
}

type BatchCollector struct {
	config  BatchConfig
	storage *storage.Postgres

	// Event queue
	eventCh chan model.EnrichedEvent
	
	// Stats
	stats Stats

	// Shutdown
	wg       sync.WaitGroup
	shutdown chan struct{}
}

type Stats struct {
	EventsReceived   atomic.Int64
	EventsProcessed  atomic.Int64
	EventsFailed     atomic.Int64
	BatchesProcessed atomic.Int64
	TotalFlushTimeNs atomic.Int64
	TotalBatchSize   atomic.Int64
}

func NewBatchCollector(config BatchConfig, storage *storage.Postgres) *BatchCollector {
	return &BatchCollector{
		config:   config,
		storage:  storage,
		eventCh:  make(chan model.EnrichedEvent, config.BatchSize*10),
		shutdown: make(chan struct{}),
	}
}

func (c *BatchCollector) Start(ctx context.Context) {
	// Start worker goroutines
	for i := 0; i < c.config.Workers; i++ {
		c.wg.Add(1)
		go c.worker(ctx, i)
	}

	slog.Info("batch collector started",
		"workers", c.config.Workers,
		"batch_size", c.config.BatchSize,
		"flush_interval", c.config.FlushInterval,
	)
}

func (c *BatchCollector) worker(ctx context.Context, id int) {
	defer c.wg.Done()

	batch := make([]model.EnrichedEvent, 0, c.config.BatchSize)
	ticker := time.NewTicker(c.config.FlushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}

		start := time.Now()
		toFlush := make([]model.EnrichedEvent, len(batch))
		copy(toFlush, batch)
		batch = batch[:0]

		// Use COPY for better performance
		if err := c.storage.CopyFrontendMetrics(ctx, toFlush); err != nil {
			slog.Error("flush failed",
				"worker", id,
				"batch_size", len(toFlush),
				"error", err,
			)
			c.stats.EventsFailed.Add(int64(len(toFlush)))
			
			// Fallback to INSERT on COPY failure
			if err := c.storage.InsertFrontendMetrics(ctx, toFlush); err != nil {
				slog.Error("insert fallback failed",
					"worker", id,
					"error", err,
				)
			} else {
				c.stats.EventsProcessed.Add(int64(len(toFlush)))
				c.stats.EventsFailed.Add(-int64(len(toFlush))) // Correct the failed count
			}
		} else {
			c.stats.EventsProcessed.Add(int64(len(toFlush)))
		}

		c.stats.BatchesProcessed.Add(1)
		c.stats.TotalFlushTimeNs.Add(time.Since(start).Nanoseconds())
		c.stats.TotalBatchSize.Add(int64(len(toFlush)))

		slog.Debug("batch flushed",
			"worker", id,
			"size", len(toFlush),
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}

	for {
		select {
		case event := <-c.eventCh:
			batch = append(batch, event)
			if len(batch) >= c.config.BatchSize {
				flush()
			}

		case <-ticker.C:
			flush()

		case <-c.shutdown:
			// Drain remaining events
			draining := true
			for draining {
				select {
				case event := <-c.eventCh:
					batch = append(batch, event)
				default:
					draining = false
				}
			}
			flush()
			slog.Info("worker shutdown", "worker", id)
			return

		case <-ctx.Done():
			flush()
			return
		}
	}
}

// Push adds an event to the queue
func (c *BatchCollector) Push(event model.EnrichedEvent) {
	c.stats.EventsReceived.Add(1)

	select {
	case c.eventCh <- event:
	default:
		// Queue full, drop event and log
		c.stats.EventsFailed.Add(1)
		slog.Warn("event dropped, queue full")
	}
}

// PushBatch adds multiple events
func (c *BatchCollector) PushBatch(events []model.EnrichedEvent) {
	for _, e := range events {
		c.Push(e)
	}
}

// Shutdown gracefully stops the collector
func (c *BatchCollector) Shutdown() {
	close(c.shutdown)
	c.wg.Wait()
	slog.Info("batch collector shutdown complete")
}

// GetStats returns current collector statistics
func (c *BatchCollector) GetStats() model.CollectorStats {
	batchCount := c.stats.BatchesProcessed.Load()
	totalSize := c.stats.TotalBatchSize.Load()
	totalFlushTime := c.stats.TotalFlushTimeNs.Load()

	var avgBatchSize, avgFlushTime float64
	if batchCount > 0 {
		avgBatchSize = float64(totalSize) / float64(batchCount)
		avgFlushTime = float64(totalFlushTime) / float64(batchCount) / 1e6 // to ms
	}

	return model.CollectorStats{
		EventsReceived:   c.stats.EventsReceived.Load(),
		EventsProcessed:  c.stats.EventsProcessed.Load(),
		EventsFailed:     c.stats.EventsFailed.Load(),
		BatchesProcessed: batchCount,
		QueueSize:        len(c.eventCh),
		AvgBatchSize:     avgBatchSize,
		AvgFlushTimeMS:   avgFlushTime,
	}
}

// QueueSize returns current queue depth
func (c *BatchCollector) QueueSize() int {
	return len(c.eventCh)
}
