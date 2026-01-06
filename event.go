package model

import (
	"encoding/json"
	"time"
)

// EventBatch from frontend SDK
type EventBatch struct {
	Events []FrontendEvent `json:"events"`
}

// FrontendEvent received from SDK
type FrontendEvent struct {
	Time        time.Time              `json:"time"`
	SessionID   string                 `json:"session_id"`
	PlayerID    *string                `json:"player_id"`
	DeviceType  string                 `json:"device_type"`
	Browser     string                 `json:"browser"`
	Country     *string                `json:"country"`
	EventType   string                 `json:"event_type"`
	PagePath    string                 `json:"page_path"`
	
	// Web Vitals
	LCP  *float64 `json:"lcp_ms"`
	FID  *float64 `json:"fid_ms"`
	CLS  *float64 `json:"cls"`
	TTFB *float64 `json:"ttfb_ms"`
	FCP  *float64 `json:"fcp_ms"`
	INP  *float64 `json:"inp_ms"`
	
	// Custom metrics
	MetricName  *string `json:"metric_name"`
	MetricValue *float64 `json:"metric_value"`
	
	// Context
	Metadata json.RawMessage `json:"metadata"`
}

// EnrichedEvent with server-side additions
type EnrichedEvent struct {
	FrontendEvent
	Country   string `json:"country"`
	UserAgent string `json:"user_agent"`
	IP        string `json:"ip"`
}

// APIMetric for backend services
type APIMetric struct {
	Time         time.Time       `json:"time"`
	ServiceName  string          `json:"service_name"`
	Endpoint     string          `json:"endpoint"`
	Method       string          `json:"method"`
	DurationMS   float64         `json:"duration_ms"`
	StatusCode   int             `json:"status_code"`
	PlayerID     *string         `json:"player_id"`
	RequestID    *string         `json:"request_id"`
	ErrorType    *string         `json:"error_type"`
	ErrorMessage *string         `json:"error_message"`
	RequestSize  *int            `json:"request_size"`
	ResponseSize *int            `json:"response_size"`
	Metadata     json.RawMessage `json:"metadata"`
}

// PSPMetric for payment tracking
type PSPMetric struct {
	Time            time.Time       `json:"time"`
	PSPName         string          `json:"psp_name"`
	Operation       string          `json:"operation"`
	DurationMS      float64         `json:"duration_ms"`
	Success         bool            `json:"success"`
	PlayerID        *string         `json:"player_id"`
	TransactionID   *string         `json:"transaction_id"`
	Amount          *float64        `json:"amount"`
	Currency        *string         `json:"currency"`
	ErrorCode       *string         `json:"error_code"`
	ErrorMessage    *string         `json:"error_message"`
	PSPResponseCode *string         `json:"psp_response_code"`
	Metadata        json.RawMessage `json:"metadata"`
}

// GameMetric for provider tracking
type GameMetric struct {
	Time          time.Time       `json:"time"`
	Provider      string          `json:"provider"`
	GameID        *string         `json:"game_id"`
	GameType      *string         `json:"game_type"`
	LoadTimeMS    *float64        `json:"load_time_ms"`
	LaunchSuccess bool            `json:"launch_success"`
	PlayerID      *string         `json:"player_id"`
	SessionID     *string         `json:"session_id"`
	DeviceType    *string         `json:"device_type"`
	ErrorType     *string         `json:"error_type"`
	ErrorMessage  *string         `json:"error_message"`
	Metadata      json.RawMessage `json:"metadata"`
}

// WebSocketMetric for real-time connection tracking
type WebSocketMetric struct {
	Time             time.Time       `json:"time"`
	ConnectionID     string          `json:"connection_id"`
	PlayerID         *string         `json:"player_id"`
	EventType        string          `json:"event_type"`
	LatencyMS        *float64        `json:"latency_ms"`
	MessagesSent     *int            `json:"messages_sent"`
	MessagesReceived *int            `json:"messages_received"`
	CloseCode        *int            `json:"close_code"`
	CloseReason      *string         `json:"close_reason"`
	Endpoint         *string         `json:"endpoint"`
	DeviceType       *string         `json:"device_type"`
	Metadata         json.RawMessage `json:"metadata"`
}

// CollectorStats for monitoring
type CollectorStats struct {
	EventsReceived   int64   `json:"events_received"`
	EventsProcessed  int64   `json:"events_processed"`
	EventsFailed     int64   `json:"events_failed"`
	BatchesProcessed int64   `json:"batches_processed"`
	QueueSize        int     `json:"queue_size"`
	AvgBatchSize     float64 `json:"avg_batch_size"`
	AvgFlushTimeMS   float64 `json:"avg_flush_time_ms"`
}
