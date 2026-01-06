package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kaasino/pulse-collector/internal/model"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(databaseURL string) (*Postgres, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Connection pool settings
	config.MaxConns = 20
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = time.Minute

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() {
	p.pool.Close()
}

func (p *Postgres) Ping(ctx context.Context) error {
	return p.pool.Ping(ctx)
}

// InsertFrontendMetrics batch inserts frontend events
func (p *Postgres) InsertFrontendMetrics(ctx context.Context, events []model.EnrichedEvent) error {
	if len(events) == 0 {
		return nil
	}

	// Build batch insert
	columns := []string{
		"time", "session_id", "player_id", "device_type", "browser", "country",
		"event_type", "page_path", "lcp_ms", "fid_ms", "cls", "ttfb_ms", "fcp_ms", "inp_ms",
		"metric_name", "metric_value", "metadata",
	}

	valueStrings := make([]string, 0, len(events))
	valueArgs := make([]interface{}, 0, len(events)*len(columns))

	for i, e := range events {
		base := i * len(columns)
		placeholders := make([]string, len(columns))
		for j := range columns {
			placeholders[j] = fmt.Sprintf("$%d", base+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ", ")+")")

		valueArgs = append(valueArgs,
			e.Time, e.SessionID, e.PlayerID, e.DeviceType, e.Browser, e.Country,
			e.EventType, e.PagePath, e.LCP, e.FID, e.CLS, e.TTFB, e.FCP, e.INP,
			e.MetricName, e.MetricValue, e.Metadata,
		)
	}

	query := fmt.Sprintf(
		"INSERT INTO frontend_metrics (%s) VALUES %s",
		strings.Join(columns, ", "),
		strings.Join(valueStrings, ", "),
	)

	_, err := p.pool.Exec(ctx, query, valueArgs...)
	return err
}

// InsertAPIMetrics batch inserts API metrics
func (p *Postgres) InsertAPIMetrics(ctx context.Context, metrics []model.APIMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	columns := []string{
		"time", "service_name", "endpoint", "method", "duration_ms", "status_code",
		"player_id", "request_id", "error_type", "error_message",
		"request_size", "response_size", "metadata",
	}

	valueStrings := make([]string, 0, len(metrics))
	valueArgs := make([]interface{}, 0, len(metrics)*len(columns))

	for i, m := range metrics {
		base := i * len(columns)
		placeholders := make([]string, len(columns))
		for j := range columns {
			placeholders[j] = fmt.Sprintf("$%d", base+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ", ")+")")

		valueArgs = append(valueArgs,
			m.Time, m.ServiceName, m.Endpoint, m.Method, m.DurationMS, m.StatusCode,
			m.PlayerID, m.RequestID, m.ErrorType, m.ErrorMessage,
			m.RequestSize, m.ResponseSize, m.Metadata,
		)
	}

	query := fmt.Sprintf(
		"INSERT INTO api_metrics (%s) VALUES %s",
		strings.Join(columns, ", "),
		strings.Join(valueStrings, ", "),
	)

	_, err := p.pool.Exec(ctx, query, valueArgs...)
	return err
}

// InsertPSPMetrics batch inserts PSP metrics
func (p *Postgres) InsertPSPMetrics(ctx context.Context, metrics []model.PSPMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	columns := []string{
		"time", "psp_name", "operation", "duration_ms", "success",
		"player_id", "transaction_id", "amount", "currency",
		"error_code", "error_message", "psp_response_code", "metadata",
	}

	valueStrings := make([]string, 0, len(metrics))
	valueArgs := make([]interface{}, 0, len(metrics)*len(columns))

	for i, m := range metrics {
		base := i * len(columns)
		placeholders := make([]string, len(columns))
		for j := range columns {
			placeholders[j] = fmt.Sprintf("$%d", base+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ", ")+")")

		valueArgs = append(valueArgs,
			m.Time, m.PSPName, m.Operation, m.DurationMS, m.Success,
			m.PlayerID, m.TransactionID, m.Amount, m.Currency,
			m.ErrorCode, m.ErrorMessage, m.PSPResponseCode, m.Metadata,
		)
	}

	query := fmt.Sprintf(
		"INSERT INTO psp_metrics (%s) VALUES %s",
		strings.Join(columns, ", "),
		strings.Join(valueStrings, ", "),
	)

	_, err := p.pool.Exec(ctx, query, valueArgs...)
	return err
}

// InsertGameMetrics batch inserts game provider metrics
func (p *Postgres) InsertGameMetrics(ctx context.Context, metrics []model.GameMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	columns := []string{
		"time", "provider", "game_id", "game_type", "load_time_ms", "launch_success",
		"player_id", "session_id", "device_type", "error_type", "error_message", "metadata",
	}

	valueStrings := make([]string, 0, len(metrics))
	valueArgs := make([]interface{}, 0, len(metrics)*len(columns))

	for i, m := range metrics {
		base := i * len(columns)
		placeholders := make([]string, len(columns))
		for j := range columns {
			placeholders[j] = fmt.Sprintf("$%d", base+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ", ")+")")

		valueArgs = append(valueArgs,
			m.Time, m.Provider, m.GameID, m.GameType, m.LoadTimeMS, m.LaunchSuccess,
			m.PlayerID, m.SessionID, m.DeviceType, m.ErrorType, m.ErrorMessage, m.Metadata,
		)
	}

	query := fmt.Sprintf(
		"INSERT INTO game_metrics (%s) VALUES %s",
		strings.Join(columns, ", "),
		strings.Join(valueStrings, ", "),
	)

	_, err := p.pool.Exec(ctx, query, valueArgs...)
	return err
}

// InsertWebSocketMetrics batch inserts WebSocket metrics
func (p *Postgres) InsertWebSocketMetrics(ctx context.Context, metrics []model.WebSocketMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	columns := []string{
		"time", "connection_id", "player_id", "event_type", "latency_ms",
		"messages_sent", "messages_received", "close_code", "close_reason",
		"endpoint", "device_type", "metadata",
	}

	valueStrings := make([]string, 0, len(metrics))
	valueArgs := make([]interface{}, 0, len(metrics)*len(columns))

	for i, m := range metrics {
		base := i * len(columns)
		placeholders := make([]string, len(columns))
		for j := range columns {
			placeholders[j] = fmt.Sprintf("$%d", base+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ", ")+")")

		valueArgs = append(valueArgs,
			m.Time, m.ConnectionID, m.PlayerID, m.EventType, m.LatencyMS,
			m.MessagesSent, m.MessagesReceived, m.CloseCode, m.CloseReason,
			m.Endpoint, m.DeviceType, m.Metadata,
		)
	}

	query := fmt.Sprintf(
		"INSERT INTO websocket_metrics (%s) VALUES %s",
		strings.Join(columns, ", "),
		strings.Join(valueStrings, ", "),
	)

	_, err := p.pool.Exec(ctx, query, valueArgs...)
	return err
}

// CopyFrontendMetrics uses COPY for maximum throughput
func (p *Postgres) CopyFrontendMetrics(ctx context.Context, events []model.EnrichedEvent) error {
	if len(events) == 0 {
		return nil
	}

	columns := []string{
		"time", "session_id", "player_id", "device_type", "browser", "country",
		"event_type", "page_path", "lcp_ms", "fid_ms", "cls", "ttfb_ms", "fcp_ms", "inp_ms",
		"metric_name", "metric_value", "metadata",
	}

	rows := make([][]interface{}, len(events))
	for i, e := range events {
		rows[i] = []interface{}{
			e.Time, e.SessionID, e.PlayerID, e.DeviceType, e.Browser, e.Country,
			e.EventType, e.PagePath, e.LCP, e.FID, e.CLS, e.TTFB, e.FCP, e.INP,
			e.MetricName, e.MetricValue, e.Metadata,
		}
	}

	_, err := p.pool.CopyFrom(
		ctx,
		pgx.Identifier{"frontend_metrics"},
		columns,
		pgx.CopyFromRows(rows),
	)

	return err
}
