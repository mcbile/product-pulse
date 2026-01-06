package handler

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/kaasino/pulse-collector/internal/collector"
	"github.com/kaasino/pulse-collector/internal/model"
	"github.com/kaasino/pulse-collector/internal/storage"
)

// ============================================
// COLLECT HANDLER
// ============================================

type CollectHandler struct {
	collector      *collector.BatchCollector
	allowedOrigins map[string]bool
	allowAll       bool
}

func NewCollectHandler(c *collector.BatchCollector, origins []string) *CollectHandler {
	h := &CollectHandler{
		collector:      c,
		allowedOrigins: make(map[string]bool),
	}

	for _, o := range origins {
		if o == "*" {
			h.allowAll = true
			break
		}
		h.allowedOrigins[o] = true
	}

	return h
}

func (h *CollectHandler) Handle(w http.ResponseWriter, r *http.Request) {
	// CORS
	origin := r.Header.Get("Origin")
	if h.allowAll {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else if h.allowedOrigins[origin] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}

	// Parse body
	var batch model.EventBatch
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		slog.Debug("invalid request body", "error", err)
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if len(batch.Events) == 0 {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	// Get client info
	clientIP := getClientIP(r)
	userAgent := r.UserAgent()
	country := resolveCountry(clientIP)

	// Enrich and queue events
	for _, event := range batch.Events {
		enriched := model.EnrichedEvent{
			FrontendEvent: event,
			Country:       country,
			UserAgent:     userAgent,
			IP:            clientIP,
		}

		// Override country if not set
		if event.Country == nil || *event.Country == "" {
			enriched.FrontendEvent.Country = &country
		}

		// Validate timestamp (not too far in past/future)
		if event.Time.IsZero() {
			enriched.FrontendEvent.Time = time.Now().UTC()
		} else {
			// Allow up to 1 hour drift
			diff := time.Since(event.Time)
			if diff < -time.Hour || diff > time.Hour {
				enriched.FrontendEvent.Time = time.Now().UTC()
			}
		}

		h.collector.Push(enriched)
	}

	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *CollectHandler) HandleCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	
	if h.allowAll {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else if h.allowedOrigins[origin] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}

	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Site-Id")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.WriteHeader(http.StatusNoContent)
}

func getClientIP(r *http.Request) string {
	// Check common proxy headers
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// resolveCountry from IP - placeholder for GeoIP integration
func resolveCountry(ip string) string {
	// TODO: Integrate MaxMind GeoIP2 or ip-api.com
	// For now, return empty and let DB handle it
	return ""
}

// ============================================
// HEALTH HANDLER
// ============================================

type HealthHandler struct {
	db *storage.Postgres
}

func NewHealthHandler(db *storage.Postgres) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Handle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *HealthHandler) HandleReady(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	if err := h.db.Ping(ctx); err != nil {
		slog.Error("readiness check failed", "error", err)
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"error","message":"database unavailable"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}

// ============================================
// METRICS HANDLER
// ============================================

type MetricsHandler struct {
	collector *collector.BatchCollector
}

func NewMetricsHandler(c *collector.BatchCollector) *MetricsHandler {
	return &MetricsHandler{collector: c}
}

func (h *MetricsHandler) Handle(w http.ResponseWriter, r *http.Request) {
	stats := h.collector.GetStats()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
