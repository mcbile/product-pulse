package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mcbile/product-pulse/internal/collector"
	"github.com/mcbile/product-pulse/internal/config"
	"github.com/mcbile/product-pulse/internal/handler"
	"github.com/mcbile/product-pulse/internal/middleware"
	"github.com/mcbile/product-pulse/internal/storage"
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

	// Go client collect endpoints (API, PSP, Game, WebSocket)
	apiCollectHandler := handler.NewAPICollectHandler(db, cfg.AllowedOrigins)
	mux.HandleFunc("POST /collect/api", apiCollectHandler.Handle)

	pspCollectHandler := handler.NewPSPCollectHandler(db, cfg.AllowedOrigins)
	mux.HandleFunc("POST /collect/psp", pspCollectHandler.Handle)

	gameCollectHandler := handler.NewGameCollectHandler(db, cfg.AllowedOrigins)
	mux.HandleFunc("POST /collect/game", gameCollectHandler.Handle)

	wsCollectHandler := handler.NewWSCollectHandler(db, cfg.AllowedOrigins)
	mux.HandleFunc("POST /collect/ws", wsCollectHandler.Handle)

	// Dashboard API endpoints
	dashboardHandler := handler.NewDashboardHandler(db, cfg.AllowedOrigins)

	// Overview
	mux.HandleFunc("GET /api/metrics/overview", dashboardHandler.HandleOverview)

	// API Performance
	mux.HandleFunc("GET /api/metrics/api", dashboardHandler.HandleAPIPerformance)
	mux.HandleFunc("GET /api/metrics/api/timeseries", dashboardHandler.HandleAPITimeSeries)

	// PSP Health
	mux.HandleFunc("GET /api/metrics/psp", dashboardHandler.HandlePSPHealth)
	mux.HandleFunc("GET /api/metrics/psp/timeseries", dashboardHandler.HandlePSPTimeSeries)

	// Web Vitals
	mux.HandleFunc("GET /api/metrics/vitals", dashboardHandler.HandleWebVitals)
	mux.HandleFunc("GET /api/metrics/vitals/timeseries", dashboardHandler.HandleWebVitalsTimeSeries)

	// Games
	mux.HandleFunc("GET /api/metrics/games", dashboardHandler.HandleGameHealth)
	mux.HandleFunc("GET /api/metrics/games/timeseries", dashboardHandler.HandleGameTimeSeries)

	// Alerts
	mux.HandleFunc("GET /api/alerts", dashboardHandler.HandleAlerts)
	mux.HandleFunc("POST /api/alerts/{alertTime}/acknowledge", dashboardHandler.HandleAcknowledgeAlert)

	// CORS preflight for dashboard
	mux.HandleFunc("OPTIONS /api/", dashboardHandler.HandleCORS)

	// Authentication endpoints
	authHandler := handler.NewAuthHandler(cfg.AllowedOrigins)
	mux.HandleFunc("POST /api/auth/login", authHandler.HandleLogin)
	mux.HandleFunc("POST /api/auth/google", authHandler.HandleGoogleLogin)
	mux.HandleFunc("POST /api/auth/logout", authHandler.HandleLogout)
	mux.HandleFunc("GET /api/auth/verify", authHandler.HandleVerify)
	mux.HandleFunc("OPTIONS /api/auth/", authHandler.HandleCORS)

	// Setup middleware chain
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst, cfg.RateLimitEnabled)
	bodySizeLimiter := middleware.NewBodySizeLimiter(cfg.MaxBodySize)

	// Middleware chain: RateLimit -> BodySize -> Logging -> Handler
	finalHandler := rateLimiter.Middleware(
		bodySizeLimiter.Middleware(
			loggingMiddleware(mux, logger),
		),
	)

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

func loggingMiddleware(next http.Handler, logger *slog.Logger) http.Handler {
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
