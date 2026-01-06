const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ============================================
// TYPES
// ============================================

export interface TimeSeriesPoint {
  time: string
  value: number
}

export interface APIPerformance {
  bucket: string
  service_name: string
  endpoint: string
  request_count: number
  avg_duration_ms: number
  p95_duration_ms: number
  p99_duration_ms: number
  error_count: number
  server_error_count: number
}

export interface PSPHealth {
  bucket: string
  psp_name: string
  operation: string
  total_count: number
  success_count: number
  avg_duration_ms: number
  p95_duration_ms: number
  total_amount: number
}

export interface WebVitals {
  bucket: string
  device_type: string
  page_path: string
  sample_count: number
  avg_lcp_ms: number
  p75_lcp_ms: number
  avg_fid_ms: number
  p75_fid_ms: number
  avg_cls: number
  p75_cls: number
  avg_inp_ms: number
  p75_inp_ms: number
}

export interface GameHealth {
  bucket: string
  provider: string
  game_type: string
  launch_count: number
  success_count: number
  avg_load_time_ms: number
  p95_load_time_ms: number
}

export interface Alert {
  time: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  source_table: string
  metric_name: string
  threshold_value: number
  actual_value: number
  acknowledged: boolean
  resolved_at: string | null
  message: string
}

export interface OverviewMetrics {
  active_sessions: number
  ggr_today: number
  deposits_count: number
  deposits_volume: number
  error_rate: number
  avg_latency_ms: number
  psp_success_rate: number
  game_success_rate: number
}

export interface CollectorStats {
  events_received: number
  events_processed: number
  events_failed: number
  batches_processed: number
  queue_size: number
  avg_batch_size: number
  avg_flush_time_ms: number
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return response.json()
}

export const api = {
  // Overview
  getOverviewMetrics: (startTime: string) =>
    fetchJSON<OverviewMetrics>('/metrics/overview', { start: startTime }),

  // API Performance
  getAPIPerformance: (startTime: string) =>
    fetchJSON<APIPerformance[]>('/metrics/api', { start: startTime }),

  getAPITimeSeries: (service: string, startTime: string) =>
    fetchJSON<TimeSeriesPoint[]>('/metrics/api/timeseries', {
      service,
      start: startTime,
    }),

  // PSP Health
  getPSPHealth: (startTime: string) =>
    fetchJSON<PSPHealth[]>('/metrics/psp', { start: startTime }),

  getPSPTimeSeries: (psp: string, startTime: string) =>
    fetchJSON<TimeSeriesPoint[]>('/metrics/psp/timeseries', {
      psp,
      start: startTime,
    }),

  // Web Vitals
  getWebVitals: (startTime: string) =>
    fetchJSON<WebVitals[]>('/metrics/vitals', { start: startTime }),

  getWebVitalsTimeSeries: (metric: string, startTime: string) =>
    fetchJSON<TimeSeriesPoint[]>('/metrics/vitals/timeseries', {
      metric,
      start: startTime,
    }),

  // Games
  getGameHealth: (startTime: string) =>
    fetchJSON<GameHealth[]>('/metrics/games', { start: startTime }),

  getGameTimeSeries: (provider: string, startTime: string) =>
    fetchJSON<TimeSeriesPoint[]>('/metrics/games/timeseries', {
      provider,
      start: startTime,
    }),

  // Alerts
  getAlerts: (resolved?: boolean) =>
    fetchJSON<Alert[]>('/alerts', {
      ...(resolved !== undefined && { resolved: String(resolved) }),
    }),

  acknowledgeAlert: (alertId: string) =>
    fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: 'POST' }),

  // Collector stats
  getCollectorStats: () => fetchJSON<CollectorStats>('/metrics'),
}

// ============================================
// MOCK DATA (for development)
// ============================================

export const mockData = {
  overview: {
    active_sessions: 1247,
    ggr_today: 45230.50,
    deposits_count: 342,
    deposits_volume: 125430.00,
    error_rate: 0.23,
    avg_latency_ms: 145,
    psp_success_rate: 98.7,
    game_success_rate: 99.2,
  } as OverviewMetrics,

  apiPerformance: [
    { bucket: '2024-01-15T10:00:00Z', service_name: 'wallet', endpoint: '/deposit', request_count: 1250, avg_duration_ms: 145, p95_duration_ms: 320, p99_duration_ms: 450, error_count: 3, server_error_count: 1 },
    { bucket: '2024-01-15T10:00:00Z', service_name: 'auth', endpoint: '/login', request_count: 3420, avg_duration_ms: 85, p95_duration_ms: 180, p99_duration_ms: 250, error_count: 12, server_error_count: 0 },
    { bucket: '2024-01-15T10:00:00Z', service_name: 'games', endpoint: '/launch', request_count: 8750, avg_duration_ms: 210, p95_duration_ms: 450, p99_duration_ms: 680, error_count: 25, server_error_count: 5 },
    { bucket: '2024-01-15T10:00:00Z', service_name: 'bonus', endpoint: '/claim', request_count: 450, avg_duration_ms: 120, p95_duration_ms: 280, p99_duration_ms: 400, error_count: 2, server_error_count: 0 },
  ] as APIPerformance[],

  pspHealth: [
    { bucket: '2024-01-15T10:00:00Z', psp_name: 'PIX', operation: 'deposit', total_count: 450, success_count: 445, avg_duration_ms: 1250, p95_duration_ms: 2800, total_amount: 85000 },
    { bucket: '2024-01-15T10:00:00Z', psp_name: 'MuchBetter', operation: 'deposit', total_count: 180, success_count: 178, avg_duration_ms: 980, p95_duration_ms: 2100, total_amount: 42000 },
    { bucket: '2024-01-15T10:00:00Z', psp_name: 'Stripe', operation: 'deposit', total_count: 120, success_count: 115, avg_duration_ms: 1450, p95_duration_ms: 3200, total_amount: 35000 },
    { bucket: '2024-01-15T10:00:00Z', psp_name: 'PIX', operation: 'withdrawal', total_count: 85, success_count: 84, avg_duration_ms: 1800, p95_duration_ms: 4500, total_amount: 25000 },
  ] as PSPHealth[],

  webVitals: [
    { bucket: '2024-01-15T10:00:00Z', device_type: 'desktop', page_path: '/', sample_count: 1250, avg_lcp_ms: 1850, p75_lcp_ms: 2400, avg_fid_ms: 45, p75_fid_ms: 85, avg_cls: 0.05, p75_cls: 0.1, avg_inp_ms: 120, p75_inp_ms: 180 },
    { bucket: '2024-01-15T10:00:00Z', device_type: 'mobile', page_path: '/', sample_count: 2450, avg_lcp_ms: 2450, p75_lcp_ms: 3200, avg_fid_ms: 65, p75_fid_ms: 120, avg_cls: 0.08, p75_cls: 0.15, avg_inp_ms: 180, p75_inp_ms: 280 },
    { bucket: '2024-01-15T10:00:00Z', device_type: 'desktop', page_path: '/games', sample_count: 3200, avg_lcp_ms: 2200, p75_lcp_ms: 2800, avg_fid_ms: 55, p75_fid_ms: 95, avg_cls: 0.03, p75_cls: 0.08, avg_inp_ms: 95, p75_inp_ms: 150 },
    { bucket: '2024-01-15T10:00:00Z', device_type: 'mobile', page_path: '/games', sample_count: 4800, avg_lcp_ms: 2850, p75_lcp_ms: 3600, avg_fid_ms: 75, p75_fid_ms: 140, avg_cls: 0.06, p75_cls: 0.12, avg_inp_ms: 160, p75_inp_ms: 250 },
  ] as WebVitals[],

  gameHealth: [
    { bucket: '2024-01-15T10:00:00Z', provider: 'Pragmatic', game_type: 'slot', launch_count: 4500, success_count: 4480, avg_load_time_ms: 1850, p95_load_time_ms: 3200 },
    { bucket: '2024-01-15T10:00:00Z', provider: 'Evolution', game_type: 'live', launch_count: 1200, success_count: 1195, avg_load_time_ms: 2450, p95_load_time_ms: 4500 },
    { bucket: '2024-01-15T10:00:00Z', provider: 'NetEnt', game_type: 'slot', launch_count: 2800, success_count: 2785, avg_load_time_ms: 1650, p95_load_time_ms: 2900 },
    { bucket: '2024-01-15T10:00:00Z', provider: 'Spribe', game_type: 'crash', launch_count: 3200, success_count: 3190, avg_load_time_ms: 980, p95_load_time_ms: 1800 },
  ] as GameHealth[],

  alerts: [
    { time: '2024-01-15T10:25:00Z', alert_type: 'psp_degraded', severity: 'warning', source_table: 'psp_metrics', metric_name: 'success_rate', threshold_value: 95, actual_value: 92.5, acknowledged: false, resolved_at: null, message: 'Stripe deposit success rate below threshold' },
    { time: '2024-01-15T10:15:00Z', alert_type: 'api_latency', severity: 'info', source_table: 'api_metrics', metric_name: 'p95_latency', threshold_value: 500, actual_value: 520, acknowledged: true, resolved_at: null, message: 'Games API p95 latency elevated' },
    { time: '2024-01-15T09:45:00Z', alert_type: 'error_spike', severity: 'critical', source_table: 'api_metrics', metric_name: 'error_rate', threshold_value: 1, actual_value: 2.5, acknowledged: true, resolved_at: '2024-01-15T10:00:00Z', message: 'Auth service error spike detected' },
  ] as Alert[],

  // Generate time series for charts
  generateTimeSeries: (points: number, baseValue: number, variance: number): TimeSeriesPoint[] => {
    const now = Date.now()
    const interval = (60 * 60 * 1000) / points // 1 hour spread
    
    return Array.from({ length: points }, (_, i) => ({
      time: new Date(now - (points - i) * interval).toISOString(),
      value: baseValue + (Math.random() - 0.5) * variance,
    }))
  },
}
