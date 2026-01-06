# CLAUDE.md — Kaasino Pulse

> **UNBREAKABLE RULES** — Следуй этим инструкциям при каждом изменении кода.

---

## Language

**Всегда отвечай на русском языке.**

---

## Project Overview

**Kaasino Pulse** — система мониторинга производительности для казино-платформы. Состоит из трёх компонентов:

1. **Go Collector** — высокопроизводительный сборщик метрик (~50k events/sec)
2. **Frontend SDK** — TypeScript SDK для браузеров (@kaasino/pulse-sdk)
3. **Dashboard** — React-приложение для визуализации метрик

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

---

## Tech Stack

| Component | Technologies |
|-----------|--------------|
| **Collector** | Go 1.22, pgx/v5 (PostgreSQL driver), slog |
| **SDK** | TypeScript, tsup (bundler) |
| **Dashboard** | React, TanStack Query, Tailwind CSS, Vite |
| **Database** | TimescaleDB (PostgreSQL extension) |
| **Deploy** | Docker, Kubernetes |

---

## Commands

```bash
# Go Collector
go run ./cmd/collector       # Запуск коллектора
go build -o pulse-collector  # Сборка
go test ./...                # Тесты

# Frontend SDK
npm install                  # Установка зависимостей
npm run build                # Сборка SDK (cjs + esm + dts)
npm run dev                  # Watch mode
npm run lint                 # ESLint
npm run typecheck            # TypeScript проверка

# Docker
docker-compose up -d         # Запуск с БД
```

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `BATCH_SIZE` | `100` | Events per batch |
| `FLUSH_INTERVAL` | `5s` | Max time between flushes |
| `WORKERS` | `4` | Parallel batch processors |
| `ALLOWED_ORIGINS` | `*` | CORS origins |
| `DEBUG` | `false` | Enable debug logging |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/collect` | POST | Приём событий от SDK |
| `/health` | GET | Liveness probe |
| `/ready` | GET | Readiness probe (проверка БД) |
| `/metrics` | GET | Статистика коллектора |

---

## Database Schema (TimescaleDB)

### Core Hypertables

| Table | Purpose | Retention |
|-------|---------|-----------|
| `frontend_metrics` | Web Vitals, page loads | 7 days |
| `api_metrics` | Backend latency, errors | 14 days |
| `psp_metrics` | Payment provider metrics | 90 days |
| `game_metrics` | Game provider performance | 30 days |
| `websocket_metrics` | WS connection quality | 7 days |
| `business_metrics` | GGR, sessions, conversions | 365 days |
| `alert_events` | Anomalies, threshold breaches | 90 days |

### Continuous Aggregates

| View | Interval | Use Case |
|------|----------|----------|
| `api_performance_1m` | 1 min | Real-time API dashboard |
| `psp_success_5m` | 5 min | PSP health monitoring |
| `web_vitals_hourly` | 1 hour | Core Web Vitals trends |
| `game_health_5m` | 5 min | Game provider status |

---

## Architecture

### Go Collector Structure

```
internal/
├── collector/
│   └── batch.go         # Batch processing, workers
├── config/
│   └── config.go        # Environment config
├── handler/
│   └── handler.go       # HTTP handlers
├── model/
│   └── event.go         # Event types
└── storage/
    └── postgres.go      # PostgreSQL COPY protocol

pkg/
└── pulse/
    └── client.go        # Go client library
```

### Dashboard Pages

| Page | Component | Description |
|------|-----------|-------------|
| Overview | `OverviewPage.tsx` | Сводка всех метрик |
| Web Vitals | `WebVitalsPage.tsx` | LCP, FID, CLS, INP |
| PSP | `PSPPage.tsx` | Платёжные провайдеры |
| API | `APIPage.tsx` | Backend endpoints |
| Games | `GamesPage.tsx` | Game providers |
| Alerts | `AlertsPage.tsx` | Оповещения |

---

## Key Metrics

### Web Vitals (Frontend)
- **LCP** (Largest Contentful Paint) — target <2.5s
- **FID** (First Input Delay) — target <100ms
- **CLS** (Cumulative Layout Shift) — target <0.1
- **INP** (Interaction to Next Paint) — target <200ms
- **TTFB** (Time to First Byte)
- **FCP** (First Contentful Paint)

### PSP Metrics
- Success rate (%)
- Average latency (ms)
- P95/P99 latency
- Transaction volume

### API Metrics
- Request count
- Error rate (4xx, 5xx)
- Average/P95/P99 duration
- Throughput (req/sec)

---

## Go Client Usage

```go
import "github.com/kaasino/pulse-collector/pkg/pulse"

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
})

// Track PSP transaction
client.TrackPSP(pulse.PSPMetric{
    PSPName:    "pix",
    Operation:  "deposit",
    DurationMS: 1234.5,
    Success:    true,
    Amount:     pulse.Float64Ptr(100.00),
    Currency:   pulse.StringPtr("BRL"),
})

// HTTP Middleware
handler := client.HTTPMiddleware("wallet")(mux)
```

---

## File Structure

```
kaasino-pulse/
├── main.go                  # Go collector entry point
├── config.go                # Configuration
├── handler.go               # HTTP handlers
├── batch.go                 # Batch processing
├── postgres.go              # Database layer
├── event.go                 # Event models
├── client.go                # Go client library
│
├── index.ts                 # TypeScript SDK entry
├── client.ts                # SDK client
│
├── App.tsx                  # Dashboard root
├── index.tsx                # React entry
├── react.tsx                # Shared components
├── *Page.tsx                # Dashboard pages
├── Header.tsx, Sidebar.tsx  # Layout components
├── TimeRangeContext.tsx     # Time range state
│
├── kaasino_pulse_schema.sql # Database schema
├── docker-compose.yml       # Local development
├── Dockerfile               # Container build
├── package.json             # Node dependencies
├── go.mod                   # Go dependencies
└── vite.config.ts           # Vite config
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Collector throughput | ~50,000 events/sec |
| Avg flush time | 10-15ms per 100 events |
| Memory baseline | ~50MB |
| CPU at 10k events/sec | <5% |

---

## Common Tasks

### Добавление нового типа метрики

1. Добавь таблицу в `kaasino_pulse_schema.sql`
2. Создай hypertable с `create_hypertable()`
3. Добавь retention policy
4. Добавь compression policy
5. Создай continuous aggregate (если нужно)
6. Добавь индексы для частых запросов
7. Обнови `event.go` с новым типом
8. Добавь handler в `handler.go`
9. Обнови SDK в `client.ts`

### Добавление страницы в Dashboard

1. Создай `NewPage.tsx` с компонентом
2. Добавь роут в `App.tsx` (type Page)
3. Добавь пункт в `Sidebar.tsx`
4. Создай queries с TanStack Query

---

## Development Tips

- Dashboard автообновляется каждые 30 секунд (`refetchInterval: 30000`)
- Используй `DEBUG=true` для подробных логов коллектора
- Для локальной разработки: `docker-compose up -d` поднимет TimescaleDB
- Continuous aggregates нужно обновлять вручную при первом запуске:
  ```sql
  CALL refresh_continuous_aggregate('api_performance_1m', NULL, NULL);
  ```

---

## Changelog

### v1.0.0 (Initial Release)
- Go Collector с batch processing и COPY protocol
- Frontend SDK (@kaasino/pulse-sdk) для Web Vitals
- Dashboard с 6 страницами (Overview, Web Vitals, PSP, API, Games, Alerts)
- TimescaleDB схема с 7 hypertables
- Continuous aggregates для real-time дашбордов
- Docker + Kubernetes deployment
- Go client library с HTTP middleware

---

## Backlog

### High Priority
- [ ] **Alerting system** — настраиваемые пороги и уведомления (Slack, Telegram, PagerDuty)
- [ ] **User sessions tracking** — связь метрик с конкретными сессиями игроков
- [ ] **Anomaly detection** — автоматическое обнаружение аномалий в метриках
- [ ] **Dashboard authentication** — авторизация для доступа к дашборду

### Medium Priority
- [ ] **Grafana integration** — экспорт метрик в Grafana
- [ ] **Custom dashboards** — возможность создавать свои дашборды
- [ ] **Retention configuration UI** — управление retention через UI
- [ ] **Export to CSV/Excel** — экспорт данных для отчётов
- [ ] **Mobile SDK** — React Native / Flutter SDK
- [ ] **Sampling configuration** — настраиваемый sampling для высоконагруженных эндпоинтов

### Low Priority
- [ ] **Multi-tenancy** — поддержка нескольких сайтов в одной инсталляции
- [ ] **Historical comparisons** — сравнение метрик week-over-week, month-over-month
- [ ] **SLA reporting** — автоматические отчёты по SLA
- [ ] **Integration tests** — E2E тесты для collector + dashboard
- [ ] **OpenTelemetry support** — интеграция с OTEL для трейсинга

### Technical Debt
- [ ] Покрыть Go код unit-тестами (target: 80%)
- [ ] Добавить E2E тесты для Dashboard
- [ ] Документация API (OpenAPI/Swagger)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Helm chart для Kubernetes
