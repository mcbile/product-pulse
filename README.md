# Kaasino Pulse Collector

High-throughput metrics collector for Kaasino performance monitoring.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend SDK   │────▶│   Go Collector  │────▶│   TimescaleDB   │
│  (browser)      │     │   (this repo)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
┌─────────────────┐            │
│  Go Services    │────────────┘
│  (internal)     │
└─────────────────┘
```

## Features

- **Batch writes** — Configurable batch size and flush interval
- **COPY protocol** — Uses PostgreSQL COPY for maximum throughput
- **Multi-worker** — Parallel processing with configurable workers
- **Graceful shutdown** — Flushes remaining events on SIGTERM
- **Health checks** — `/health` and `/ready` endpoints
- **Self-monitoring** — `/metrics` endpoint for collector stats

## Quick Start

```bash
# Start with docker-compose
docker-compose up -d

# Or run locally
export DATABASE_URL=postgres://pulse:pulse@localhost:5432/pulse?sslmode=disable
go run ./cmd/collector
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `BATCH_SIZE` | `100` | Events per batch |
| `FLUSH_INTERVAL` | `5s` | Max time between flushes |
| `WORKERS` | `4` | Parallel batch processors |
| `ALLOWED_ORIGINS` | `*` | CORS origins (comma-separated) |
| `DEBUG` | `false` | Enable debug logging |

## API Endpoints

### POST /collect
Receives frontend events from the SDK.

```bash
curl -X POST http://localhost:8080/collect \
  -H "Content-Type: application/json" \
  -H "X-Site-Id: kaasino-prod" \
  -d '{
    "events": [{
      "time": "2024-01-15T10:30:00Z",
      "session_id": "abc-123",
      "event_type": "web_vital",
      "page_path": "/games",
      "lcp_ms": 1234.5,
      "metric_name": "LCP"
    }]
  }'
```

### GET /health
Liveness probe (always returns 200).

### GET /ready
Readiness probe (checks database connection).

### GET /metrics
Collector statistics.

```json
{
  "events_received": 15234,
  "events_processed": 15200,
  "events_failed": 34,
  "batches_processed": 152,
  "queue_size": 45,
  "avg_batch_size": 100,
  "avg_flush_time_ms": 12.5
}
```

## Go Client for Internal Services

```go
import "github.com/kaasino/pulse-collector/pkg/pulse"

// Initialize
client := pulse.NewClient(pulse.ClientConfig{
    Endpoint:      "http://pulse-collector:8080",
    SiteID:        "kaasino-internal",
    FlushInterval: 5 * time.Second,
    BatchSize:     50,
})
defer client.Close()

// Track API call
client.TrackAPI(pulse.APIMetric{
    ServiceName: "wallet",
    Endpoint:    "/api/v1/deposit",
    Method:      "POST",
    DurationMS:  45.2,
    StatusCode:  200,
    PlayerID:    pulse.StringPtr("player-123"),
})

// Track PSP transaction
client.TrackPSP(pulse.PSPMetric{
    PSPName:       "pix",
    Operation:     "deposit",
    DurationMS:    1234.5,
    Success:       true,
    PlayerID:      pulse.StringPtr("player-123"),
    TransactionID: pulse.StringPtr("tx-456"),
    Amount:        pulse.Float64Ptr(100.00),
    Currency:      pulse.StringPtr("BRL"),
})

// HTTP Middleware (auto-tracks all requests)
mux := http.NewServeMux()
handler := client.HTTPMiddleware("wallet")(mux)
```

## Performance

Tested on 4-core VM:

| Metric | Value |
|--------|-------|
| Throughput | ~50,000 events/sec |
| Avg flush time | 10-15ms per 100 events |
| Memory | ~50MB baseline |
| CPU | <5% at 10k events/sec |

## Deployment

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pulse-collector
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: collector
        image: kaasino/pulse-collector:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pulse-secrets
              key: database-url
        - name: BATCH_SIZE
          value: "100"
        - name: WORKERS
          value: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
```

## Project Structure

```
pulse-collector/
├── cmd/
│   └── collector/
│       └── main.go          # Entry point
├── internal/
│   ├── collector/
│   │   └── batch.go         # Batch processing
│   ├── config/
│   │   └── config.go        # Configuration
│   ├── handler/
│   │   └── handler.go       # HTTP handlers
│   ├── model/
│   │   └── event.go         # Data models
│   └── storage/
│       └── postgres.go      # Database layer
├── pkg/
│   └── pulse/
│       └── client.go        # Go client library
├── Dockerfile
├── docker-compose.yml
├── go.mod
└── README.md
```

## License
© 2026 McBile AI-Engine
