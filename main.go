package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kaasino/pulse-collector/internal/collector"
	"github.com/kaasino/pulse-collector/internal/config"
	"github.com/kaasino/pulse-collector/internal/handler"
	"github.com/kaasino/pulse-collector/internal/storage"
)

func main() {
	// Load config
	cfg := config.Load()

	// Setup logger
	logLevel := slog.LevelInfo
	if cfg.Debug {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	// Connect to database
	db, err := storage.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create batch collector
	batchCollector := collector.NewBatchCollector(collector.BatchConfig{
		BatchSize:     cfg.BatchSize,
		FlushInterval: cfg.FlushInterval,
		Workers:       cfg.Workers,
	}, db)

	// Start collector
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	batchCollector.Start(ctx)

	// Setup HTTP handlers
	mux := http.NewServeMux()

	collectHandler := handler.NewCollectHandler(batchCollector, cfg.AllowedOrigins)
	mux.HandleFunc("POST /collect", collectHandler.Handle)
	mux.HandleFunc("OPTIONS /collect", collectHandler.HandleCORS)

	healthHandler := handler.NewHealthHandler(db)
	mux.HandleFunc("GET /health", healthHandler.Handle)
	mux.HandleFunc("GET /ready", healthHandler.HandleReady)

	metricsHandler := handler.NewMetricsHandler(batchCollector)
	mux.HandleFunc("GET /metrics", metricsHandler.Handle)

	// Middleware
	finalHandler := middleware(mux, logger)

	// Create server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      finalHandler,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("starting pulse collector", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down...")

	// Stop accepting new events
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Flush remaining events
	batchCollector.Shutdown()

	// Shutdown HTTP server
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
	}

	slog.Info("shutdown complete")
}

func middleware(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status
		wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		logger.Debug("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", wrapped.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"ip", r.RemoteAddr,
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}
