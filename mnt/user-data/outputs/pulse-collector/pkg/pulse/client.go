package pulse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Client for Go services to report metrics directly to the collector
type Client struct {
	endpoint   string
	httpClient *http.Client
	siteID     string

	// Batching
	mu            sync.Mutex
	apiMetrics    []APIMetric
	pspMetrics    []PSPMetric
	gameMetrics   []GameMetric
	wsMetrics     []WebSocketMetric
	flushInterval time.Duration
	batchSize     int

	// Shutdown
	done chan struct{}
	wg   sync.WaitGroup
}

type ClientConfig struct {
	Endpoint      string
	SiteID        string
	FlushInterval time.Duration
	BatchSize     int
	Timeout       time.Duration
}

// Metric types for internal services
type APIMetric struct {
	Time         time.Time              `json:"time"`
	ServiceName  string                 `json:"service_name"`
	Endpoint     string                 `json:"endpoint"`
	Method       string                 `json:"method"`
	DurationMS   float64                `json:"duration_ms"`
	StatusCode   int                    `json:"status_code"`
	PlayerID     *string                `json:"player_id,omitempty"`
	RequestID    *string                `json:"request_id,omitempty"`
	ErrorType    *string                `json:"error_type,omitempty"`
	ErrorMessage *string                `json:"error_message,omitempty"`
	RequestSize  *int                   `json:"request_size,omitempty"`
	ResponseSize *int                   `json:"response_size,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type PSPMetric struct {
	Time            time.Time              `json:"time"`
	PSPName         string                 `json:"psp_name"`
	Operation       string                 `json:"operation"`
	DurationMS      float64                `json:"duration_ms"`
	Success         bool                   `json:"success"`
	PlayerID        *string                `json:"player_id,omitempty"`
	TransactionID   *string                `json:"transaction_id,omitempty"`
	Amount          *float64               `json:"amount,omitempty"`
	Currency        *string                `json:"currency,omitempty"`
	ErrorCode       *string                `json:"error_code,omitempty"`
	ErrorMessage    *string                `json:"error_message,omitempty"`
	PSPResponseCode *string                `json:"psp_response_code,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

type GameMetric struct {
	Time          time.Time              `json:"time"`
	Provider      string                 `json:"provider"`
	GameID        *string                `json:"game_id,omitempty"`
	GameType      *string                `json:"game_type,omitempty"`
	LoadTimeMS    *float64               `json:"load_time_ms,omitempty"`
	LaunchSuccess bool                   `json:"launch_success"`
	PlayerID      *string                `json:"player_id,omitempty"`
	SessionID     *string                `json:"session_id,omitempty"`
	DeviceType    *string                `json:"device_type,omitempty"`
	ErrorType     *string                `json:"error_type,omitempty"`
	ErrorMessage  *string                `json:"error_message,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type WebSocketMetric struct {
	Time             time.Time              `json:"time"`
	ConnectionID     string                 `json:"connection_id"`
	PlayerID         *string                `json:"player_id,omitempty"`
	EventType        string                 `json:"event_type"`
	LatencyMS        *float64               `json:"latency_ms,omitempty"`
	MessagesSent     *int                   `json:"messages_sent,omitempty"`
	MessagesReceived *int                   `json:"messages_received,omitempty"`
	CloseCode        *int                   `json:"close_code,omitempty"`
	CloseReason      *string                `json:"close_reason,omitempty"`
	Endpoint         *string                `json:"endpoint,omitempty"`
	DeviceType       *string                `json:"device_type,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

func NewClient(cfg ClientConfig) *Client {
	if cfg.FlushInterval == 0 {
		cfg.FlushInterval = 5 * time.Second
	}
	if cfg.BatchSize == 0 {
		cfg.BatchSize = 50
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Second
	}

	c := &Client{
		endpoint: cfg.Endpoint,
		siteID:   cfg.SiteID,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		flushInterval: cfg.FlushInterval,
		batchSize:     cfg.BatchSize,
		done:          make(chan struct{}),
	}

	c.wg.Add(1)
	go c.flushLoop()

	return c
}

func (c *Client) flushLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.Flush(context.Background())
		case <-c.done:
			c.Flush(context.Background())
			return
		}
	}
}

// TrackAPI records an API call metric
func (c *Client) TrackAPI(m APIMetric) {
	if m.Time.IsZero() {
		m.Time = time.Now().UTC()
	}

	c.mu.Lock()
	c.apiMetrics = append(c.apiMetrics, m)
	shouldFlush := len(c.apiMetrics) >= c.batchSize
	c.mu.Unlock()

	if shouldFlush {
		go c.Flush(context.Background())
	}
}

// TrackPSP records a payment provider metric
func (c *Client) TrackPSP(m PSPMetric) {
	if m.Time.IsZero() {
		m.Time = time.Now().UTC()
	}

	c.mu.Lock()
	c.pspMetrics = append(c.pspMetrics, m)
	shouldFlush := len(c.pspMetrics) >= c.batchSize
	c.mu.Unlock()

	if shouldFlush {
		go c.Flush(context.Background())
	}
}

// TrackGame records a game provider metric
func (c *Client) TrackGame(m GameMetric) {
	if m.Time.IsZero() {
		m.Time = time.Now().UTC()
	}

	c.mu.Lock()
	c.gameMetrics = append(c.gameMetrics, m)
	shouldFlush := len(c.gameMetrics) >= c.batchSize
	c.mu.Unlock()

	if shouldFlush {
		go c.Flush(context.Background())
	}
}

// TrackWebSocket records a WebSocket connection metric
func (c *Client) TrackWebSocket(m WebSocketMetric) {
	if m.Time.IsZero() {
		m.Time = time.Now().UTC()
	}

	c.mu.Lock()
	c.wsMetrics = append(c.wsMetrics, m)
	shouldFlush := len(c.wsMetrics) >= c.batchSize
	c.mu.Unlock()

	if shouldFlush {
		go c.Flush(context.Background())
	}
}

// Flush sends all buffered metrics
func (c *Client) Flush(ctx context.Context) error {
	c.mu.Lock()
	api := c.apiMetrics
	psp := c.pspMetrics
	game := c.gameMetrics
	ws := c.wsMetrics

	c.apiMetrics = nil
	c.pspMetrics = nil
	c.gameMetrics = nil
	c.wsMetrics = nil
	c.mu.Unlock()

	var errs []error

	if len(api) > 0 {
		if err := c.send(ctx, "/collect/api", api); err != nil {
			errs = append(errs, fmt.Errorf("api metrics: %w", err))
		}
	}

	if len(psp) > 0 {
		if err := c.send(ctx, "/collect/psp", psp); err != nil {
			errs = append(errs, fmt.Errorf("psp metrics: %w", err))
		}
	}

	if len(game) > 0 {
		if err := c.send(ctx, "/collect/game", game); err != nil {
			errs = append(errs, fmt.Errorf("game metrics: %w", err))
		}
	}

	if len(ws) > 0 {
		if err := c.send(ctx, "/collect/ws", ws); err != nil {
			errs = append(errs, fmt.Errorf("ws metrics: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("flush errors: %v", errs)
	}

	return nil
}

func (c *Client) send(ctx context.Context, path string, data interface{}) error {
	body, err := json.Marshal(map[string]interface{}{
		"metrics": data,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+path, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Site-Id", c.siteID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("http error: %d", resp.StatusCode)
	}

	return nil
}

// Close shuts down the client gracefully
func (c *Client) Close() error {
	close(c.done)
	c.wg.Wait()
	return nil
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

// HTTPMiddleware wraps http handlers to automatically track API metrics
func (c *Client) HTTPMiddleware(serviceName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap response writer
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			// Record metric
			c.TrackAPI(APIMetric{
				Time:        start,
				ServiceName: serviceName,
				Endpoint:    r.URL.Path,
				Method:      r.Method,
				DurationMS:  float64(time.Since(start).Milliseconds()),
				StatusCode:  wrapped.status,
			})
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

func StringPtr(s string) *string    { return &s }
func IntPtr(i int) *int             { return &i }
func Float64Ptr(f float64) *float64 { return &f }
