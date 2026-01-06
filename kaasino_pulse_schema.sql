-- ============================================
-- KAASINO PULSE - Performance Monitoring Schema
-- TimescaleDB + PostgreSQL
-- ============================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- CORE METRICS TABLES (Hypertables)
-- ============================================

-- 1. Frontend Performance Events
-- Web Vitals, page loads, interactions
CREATE TABLE frontend_metrics (
    time            TIMESTAMPTZ NOT NULL,
    session_id      UUID NOT NULL,
    player_id       UUID,
    device_type     VARCHAR(20),  -- desktop, mobile, tablet
    browser         VARCHAR(50),
    country         VARCHAR(2),
    
    -- Event identification
    event_type      VARCHAR(50) NOT NULL,  -- page_load, web_vital, interaction, error
    page_path       VARCHAR(255),
    
    -- Web Vitals
    lcp_ms          DECIMAL(10,2),  -- Largest Contentful Paint
    fid_ms          DECIMAL(10,2),  -- First Input Delay
    cls             DECIMAL(6,4),   -- Cumulative Layout Shift
    ttfb_ms         DECIMAL(10,2),  -- Time to First Byte
    fcp_ms          DECIMAL(10,2),  -- First Contentful Paint
    inp_ms          DECIMAL(10,2),  -- Interaction to Next Paint
    
    -- Custom metrics
    metric_name     VARCHAR(100),
    metric_value    DECIMAL(15,4),
    
    -- Context
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('frontend_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- 2. API Performance Metrics
-- Backend latency, errors, throughput
CREATE TABLE api_metrics (
    time            TIMESTAMPTZ NOT NULL,
    service_name    VARCHAR(50) NOT NULL,  -- auth, wallet, games, bonus
    endpoint        VARCHAR(255) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    
    -- Performance
    duration_ms     DECIMAL(10,2) NOT NULL,
    status_code     SMALLINT NOT NULL,
    
    -- Context
    player_id       UUID,
    request_id      UUID,
    error_type      VARCHAR(100),
    error_message   TEXT,
    
    -- Load info
    request_size    INTEGER,
    response_size   INTEGER,
    
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('api_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- 3. PSP (Payment Service Provider) Metrics
-- Critical for deposit/withdrawal monitoring
CREATE TABLE psp_metrics (
    time            TIMESTAMPTZ NOT NULL,
    psp_name        VARCHAR(50) NOT NULL,  -- stripe, pix, muchbetter, etc
    operation       VARCHAR(20) NOT NULL,  -- deposit, withdrawal, verify
    
    -- Performance
    duration_ms     DECIMAL(10,2) NOT NULL,
    success         BOOLEAN NOT NULL,
    
    -- Transaction context
    player_id       UUID,
    transaction_id  UUID,
    amount          DECIMAL(15,2),
    currency        VARCHAR(3),
    
    -- Error tracking
    error_code      VARCHAR(50),
    error_message   TEXT,
    
    -- PSP response
    psp_response_code VARCHAR(50),
    
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('psp_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- 4. Game Provider Metrics
-- SoftSwiss, Pragmatic, etc
CREATE TABLE game_metrics (
    time            TIMESTAMPTZ NOT NULL,
    provider        VARCHAR(50) NOT NULL,
    game_id         VARCHAR(100),
    game_type       VARCHAR(30),  -- slot, live, table, crash
    
    -- Performance
    load_time_ms    DECIMAL(10,2),
    launch_success  BOOLEAN NOT NULL,
    
    -- Session context
    player_id       UUID,
    session_id      UUID,
    device_type     VARCHAR(20),
    
    -- Error tracking
    error_type      VARCHAR(100),
    error_message   TEXT,
    
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('game_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- 5. WebSocket Connection Metrics
-- Live games, real-time updates
CREATE TABLE websocket_metrics (
    time            TIMESTAMPTZ NOT NULL,
    connection_id   UUID NOT NULL,
    player_id       UUID,
    
    event_type      VARCHAR(30) NOT NULL,  -- connect, disconnect, error, reconnect
    
    -- Connection quality
    latency_ms      DECIMAL(10,2),
    messages_sent   INTEGER,
    messages_received INTEGER,
    
    -- Disconnect reasons
    close_code      SMALLINT,
    close_reason    VARCHAR(255),
    
    -- Context
    endpoint        VARCHAR(100),
    device_type     VARCHAR(20),
    
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('websocket_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

-- 6. Business Metrics (Aggregated)
-- GGR, sessions, conversions
CREATE TABLE business_metrics (
    time            TIMESTAMPTZ NOT NULL,
    metric_type     VARCHAR(50) NOT NULL,  -- active_sessions, ggr, deposits, etc
    
    -- Values
    value           DECIMAL(20,4) NOT NULL,
    count           INTEGER,
    
    -- Dimensions
    segment         VARCHAR(50),  -- vip, regular, new
    country         VARCHAR(2),
    device_type     VARCHAR(20),
    
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('business_metrics', 'time',
    chunk_time_interval => INTERVAL '1 hour'
);

-- 7. Alert Events
-- Anomalies, threshold breaches
CREATE TABLE alert_events (
    time            TIMESTAMPTZ NOT NULL,
    alert_type      VARCHAR(50) NOT NULL,
    severity        VARCHAR(10) NOT NULL,  -- info, warning, critical
    
    -- Context
    source_table    VARCHAR(50),
    metric_name     VARCHAR(100),
    threshold_value DECIMAL(15,4),
    actual_value    DECIMAL(15,4),
    
    -- Status
    acknowledged    BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    
    message         TEXT,
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('alert_events', 'time',
    chunk_time_interval => INTERVAL '7 days'
);

-- ============================================
-- INDEXES FOR COMMON QUERIES
-- ============================================

-- Frontend
CREATE INDEX idx_frontend_session ON frontend_metrics (session_id, time DESC);
CREATE INDEX idx_frontend_player ON frontend_metrics (player_id, time DESC) WHERE player_id IS NOT NULL;
CREATE INDEX idx_frontend_event_type ON frontend_metrics (event_type, time DESC);
CREATE INDEX idx_frontend_page ON frontend_metrics (page_path, time DESC);

-- API
CREATE INDEX idx_api_service ON api_metrics (service_name, time DESC);
CREATE INDEX idx_api_endpoint ON api_metrics (endpoint, time DESC);
CREATE INDEX idx_api_errors ON api_metrics (status_code, time DESC) WHERE status_code >= 400;

-- PSP
CREATE INDEX idx_psp_provider ON psp_metrics (psp_name, time DESC);
CREATE INDEX idx_psp_operation ON psp_metrics (operation, success, time DESC);
CREATE INDEX idx_psp_errors ON psp_metrics (psp_name, time DESC) WHERE NOT success;

-- Games
CREATE INDEX idx_game_provider ON game_metrics (provider, time DESC);
CREATE INDEX idx_game_errors ON game_metrics (provider, time DESC) WHERE NOT launch_success;

-- WebSocket
CREATE INDEX idx_ws_player ON websocket_metrics (player_id, time DESC) WHERE player_id IS NOT NULL;
CREATE INDEX idx_ws_errors ON websocket_metrics (time DESC) WHERE event_type = 'error';

-- Business
CREATE INDEX idx_business_type ON business_metrics (metric_type, time DESC);

-- Alerts
CREATE INDEX idx_alerts_unresolved ON alert_events (severity, time DESC) WHERE resolved_at IS NULL;

-- ============================================
-- RETENTION POLICIES
-- ============================================

-- Raw frontend metrics: 7 days (high volume)
SELECT add_retention_policy('frontend_metrics', INTERVAL '7 days');

-- API metrics: 14 days
SELECT add_retention_policy('api_metrics', INTERVAL '14 days');

-- PSP metrics: 90 days (compliance/audit)
SELECT add_retention_policy('psp_metrics', INTERVAL '90 days');

-- Game metrics: 30 days
SELECT add_retention_policy('game_metrics', INTERVAL '30 days');

-- WebSocket: 7 days
SELECT add_retention_policy('websocket_metrics', INTERVAL '7 days');

-- Business metrics: 1 year
SELECT add_retention_policy('business_metrics', INTERVAL '365 days');

-- Alerts: 90 days
SELECT add_retention_policy('alert_events', INTERVAL '90 days');

-- ============================================
-- COMPRESSION POLICIES
-- ============================================

-- Enable compression on all hypertables
ALTER TABLE frontend_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'event_type, device_type',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('frontend_metrics', INTERVAL '1 day');

ALTER TABLE api_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'service_name, endpoint',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('api_metrics', INTERVAL '2 days');

ALTER TABLE psp_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'psp_name, operation',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('psp_metrics', INTERVAL '3 days');

ALTER TABLE game_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'provider',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('game_metrics', INTERVAL '2 days');

ALTER TABLE websocket_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'event_type',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('websocket_metrics', INTERVAL '1 day');

ALTER TABLE business_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'metric_type',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('business_metrics', INTERVAL '7 days');

-- ============================================
-- CONTINUOUS AGGREGATES (Materialized Views)
-- Real-time dashboards need pre-computed data
-- ============================================

-- API Performance Summary (1-minute buckets)
CREATE MATERIALIZED VIEW api_performance_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    service_name,
    endpoint,
    COUNT(*) AS request_count,
    AVG(duration_ms) AS avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS error_count,
    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS server_error_count
FROM api_metrics
GROUP BY bucket, service_name, endpoint
WITH NO DATA;

SELECT add_continuous_aggregate_policy('api_performance_1m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- PSP Success Rates (5-minute buckets)
CREATE MATERIALIZED VIEW psp_success_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    psp_name,
    operation,
    COUNT(*) AS total_count,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS success_count,
    AVG(duration_ms) AS avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    SUM(amount) FILTER (WHERE success) AS total_amount
FROM psp_metrics
GROUP BY bucket, psp_name, operation
WITH NO DATA;

SELECT add_continuous_aggregate_policy('psp_success_5m',
    start_offset => INTERVAL '30 minutes',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- Web Vitals Summary (hourly)
CREATE MATERIALIZED VIEW web_vitals_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_type,
    page_path,
    COUNT(*) AS sample_count,
    -- LCP
    AVG(lcp_ms) AS avg_lcp_ms,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lcp_ms) AS p75_lcp_ms,
    -- FID
    AVG(fid_ms) AS avg_fid_ms,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fid_ms) AS p75_fid_ms,
    -- CLS
    AVG(cls) AS avg_cls,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cls) AS p75_cls,
    -- INP
    AVG(inp_ms) AS avg_inp_ms,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY inp_ms) AS p75_inp_ms
FROM frontend_metrics
WHERE event_type = 'web_vital'
GROUP BY bucket, device_type, page_path
WITH NO DATA;

SELECT add_continuous_aggregate_policy('web_vitals_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Game Provider Health (5-minute buckets)
CREATE MATERIALIZED VIEW game_health_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    provider,
    game_type,
    COUNT(*) AS launch_count,
    SUM(CASE WHEN launch_success THEN 1 ELSE 0 END) AS success_count,
    AVG(load_time_ms) AS avg_load_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY load_time_ms) AS p95_load_time_ms
FROM game_metrics
GROUP BY bucket, provider, game_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('game_health_5m',
    start_offset => INTERVAL '30 minutes',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate error rate for a service
CREATE OR REPLACE FUNCTION get_error_rate(
    p_service_name VARCHAR,
    p_interval INTERVAL DEFAULT '5 minutes'
)
RETURNS TABLE(error_rate DECIMAL, total_requests BIGINT, error_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::DECIMAL / 
              NULLIF(COUNT(*), 0) * 100, 2) AS error_rate,
        COUNT(*) AS total_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS error_count
    FROM api_metrics
    WHERE service_name = p_service_name
      AND time > NOW() - p_interval;
END;
$$ LANGUAGE plpgsql;

-- Get PSP health status
CREATE OR REPLACE FUNCTION get_psp_health(
    p_interval INTERVAL DEFAULT '15 minutes'
)
RETURNS TABLE(
    psp_name VARCHAR,
    success_rate DECIMAL,
    avg_latency DECIMAL,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pm.psp_name,
        ROUND(SUM(CASE WHEN pm.success THEN 1 ELSE 0 END)::DECIMAL / 
              NULLIF(COUNT(*), 0) * 100, 2) AS success_rate,
        ROUND(AVG(pm.duration_ms), 2) AS avg_latency,
        COUNT(*) AS total_count
    FROM psp_metrics pm
    WHERE pm.time > NOW() - p_interval
    GROUP BY pm.psp_name
    ORDER BY success_rate ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- EXAMPLE QUERIES FOR DASHBOARD
-- ============================================

-- Real-time API health (last 5 minutes)
-- SELECT * FROM api_performance_1m 
-- WHERE bucket > NOW() - INTERVAL '5 minutes'
-- ORDER BY bucket DESC;

-- PSP success rates
-- SELECT * FROM get_psp_health('15 minutes');

-- Web Vitals by page (last 24 hours)
-- SELECT * FROM web_vitals_hourly
-- WHERE bucket > NOW() - INTERVAL '24 hours'
-- ORDER BY bucket DESC;

-- Active alerts
-- SELECT * FROM alert_events
-- WHERE resolved_at IS NULL
-- ORDER BY severity DESC, time DESC;

-- ============================================
-- GRANTS (adjust for your setup)
-- ============================================

-- Read-only role for dashboard
-- CREATE ROLE pulse_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO pulse_reader;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pulse_reader;

-- Writer role for collectors
-- CREATE ROLE pulse_writer;
-- GRANT INSERT ON frontend_metrics, api_metrics, psp_metrics, game_metrics, websocket_metrics, business_metrics TO pulse_writer;
