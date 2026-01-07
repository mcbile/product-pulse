// Types
export interface Alert {
  id: number
  time: string
  severity: 'critical' | 'warning' | 'info'
  alert_type: string
  message: string
  source_table: string
  threshold_value: number
  actual_value: number
  acknowledged: boolean
  resolved_at?: string
  type?: string // legacy support
}

// Mock data for development
export const mockData = {
  overview: {
    activeSessions: 1247,
    active_sessions: 1247,
    avgLatency: 145,
    avg_latency_ms: 145,
    errorRate: 0.34,
    error_rate: 0.34,
    ggr: 24580,
    ggr_today: 24580,
    deposits_count: 156,
    deposits_volume: 45200,
    psp_success_rate: 98.5,
    game_success_rate: 99.2,
  },

  pspHealth: [
    { name: 'PIX', psp_name: 'PIX', operation: 'deposit', successRate: 99.2, success_count: 992, total_count: 1000, avgLatency: 234, volume: 1250 },
    { name: 'Stripe', psp_name: 'Stripe', operation: 'deposit', successRate: 98.8, success_count: 988, total_count: 1000, avgLatency: 312, volume: 890 },
    { name: 'MuchBetter', psp_name: 'MuchBetter', operation: 'deposit', successRate: 97.5, success_count: 975, total_count: 1000, avgLatency: 445, volume: 456 },
    { name: 'Skrill', psp_name: 'Skrill', operation: 'deposit', successRate: 99.1, success_count: 991, total_count: 1000, avgLatency: 289, volume: 234 },
  ],

  apiPerformance: [
    { endpoint: '/api/auth/login', service_name: 'auth', avgDuration: 89, avg_duration_ms: 89, p95_duration_ms: 120, requests: 5420, request_count: 5420, errorRate: 0.1, error_count: 5 },
    { endpoint: '/api/wallet/balance', service_name: 'wallet', avgDuration: 45, avg_duration_ms: 45, p95_duration_ms: 80, requests: 12300, request_count: 12300, errorRate: 0.05, error_count: 6 },
    { endpoint: '/api/games/launch', service_name: 'games', avgDuration: 234, avg_duration_ms: 234, p95_duration_ms: 450, requests: 3200, request_count: 3200, errorRate: 0.8, error_count: 26 },
    { endpoint: '/api/bonus/claim', service_name: 'bonus', avgDuration: 156, avg_duration_ms: 156, p95_duration_ms: 280, requests: 890, request_count: 890, errorRate: 0.3, error_count: 3 },
  ],

  webVitals: {
    lcp: { value: 2.1, rating: 'good' },
    fid: { value: 45, rating: 'good' },
    cls: { value: 0.08, rating: 'good' },
    inp: { value: 180, rating: 'needs-improvement' },
    ttfb: { value: 320, rating: 'good' },
    fcp: { value: 1.4, rating: 'good' },
  },

  gameProviders: [
    { name: 'Pragmatic', successRate: 99.5, avgLoadTime: 1.2, launches: 4500 },
    { name: 'Evolution', successRate: 98.9, avgLoadTime: 1.8, launches: 3200 },
    { name: 'NetEnt', successRate: 99.2, avgLoadTime: 1.4, launches: 2100 },
    { name: 'Play\'n GO', successRate: 99.0, avgLoadTime: 1.5, launches: 1800 },
  ],

  alerts: [
    {
      id: 1,
      time: new Date(Date.now() - 5 * 60000).toISOString(),
      severity: 'warning' as const,
      alert_type: 'psp_latency_high',
      message: 'PSP MuchBetter latency increased by 25%',
      source_table: 'psp_transactions',
      threshold_value: 300,
      actual_value: 445,
      acknowledged: false,
      type: 'warning',
    },
    {
      id: 2,
      time: new Date(Date.now() - 12 * 60000).toISOString(),
      severity: 'critical' as const,
      alert_type: 'game_error_spike',
      message: 'Game provider Pragmatic error rate spike',
      source_table: 'game_launches',
      threshold_value: 1,
      actual_value: 2.5,
      acknowledged: false,
      type: 'critical',
    },
    {
      id: 3,
      time: new Date(Date.now() - 30 * 60000).toISOString(),
      severity: 'info' as const,
      alert_type: 'scheduled_maintenance',
      message: 'Scheduled maintenance in 2 hours',
      source_table: 'system_events',
      threshold_value: 0,
      actual_value: 0,
      acknowledged: true,
      type: 'info',
    },
  ] as Alert[],

  generateTimeSeries: (points: number, baseValue: number, variance: number) => {
    return Array.from({ length: points }, (_, i) => ({
      time: new Date(Date.now() - (points - i) * 3600000).toISOString(),
      value: baseValue + (Math.random() - 0.5) * variance,
    }))
  },
}

// API client for production
export async function fetchMetrics(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`/api${endpoint}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
