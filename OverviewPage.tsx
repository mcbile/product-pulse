import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, DollarSign, Activity, AlertTriangle, Server, Gamepad2 } from 'lucide-react'
import { useTimeRange } from './TimeRangeContext'
import { useFilters } from './App'
import { mockData } from './apiClient'
import { MetricCard, Card, SectionHeader, StatusBadge, ProgressBar } from './ui'

export function OverviewPage() {
  const { getStartTime, label } = useTimeRange()
  const { appliedBrand, appliedCountry } = useFilters()

  // Generate data based on applied filters
  const getFilterMultiplier = () => {
    let mult = 1
    if (appliedBrand === 'Kaasino') mult *= 1.2
    if (appliedBrand === 'Bet4star') mult *= 0.8
    if (appliedCountry === 'NL') mult *= 1.1
    if (appliedCountry === 'GB') mult *= 0.9
    if (appliedCountry === 'DE') mult *= 1.0
    if (appliedCountry === 'N/A') mult *= 0.5
    return mult
  }

  const filterMult = getFilterMultiplier()

  // In production, replace mockData with actual API calls
  const { data: overview } = useQuery({
    queryKey: ['overview', getStartTime().toISOString(), appliedBrand, appliedCountry],
    queryFn: () => Promise.resolve({
      ...mockData.overview,
      active_sessions: Math.round(mockData.overview.active_sessions * filterMult),
      ggr_today: Math.round(mockData.overview.ggr_today * filterMult),
      deposits_count: Math.round(mockData.overview.deposits_count * filterMult),
      deposits_volume: Math.round(mockData.overview.deposits_volume * filterMult),
    }),
  })

  const { data: pspData } = useQuery({
    queryKey: ['psp-overview', getStartTime().toISOString(), appliedBrand, appliedCountry],
    queryFn: () => Promise.resolve(mockData.pspHealth),
  })

  const { data: apiData } = useQuery({
    queryKey: ['api-overview', getStartTime().toISOString(), appliedBrand, appliedCountry],
    queryFn: () => Promise.resolve(mockData.apiPerformance),
  })

  const latencyTrend = mockData.generateTimeSeries(24, 150 * filterMult, 50)
  const sessionsTrend = mockData.generateTimeSeries(24, 1200 * filterMult, 300)

  const getLatencyStatus = (ms: number): 'good' | 'warning' | 'critical' => {
    if (ms < 200) return 'good'
    if (ms < 500) return 'warning'
    return 'critical'
  }

  const getErrorStatus = (rate: number): 'good' | 'warning' | 'critical' => {
    if (rate < 0.5) return 'good'
    if (rate < 2) return 'warning'
    return 'critical'
  }

  // Custom tooltip for charts with theme support
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="tooltip">
          <p className="text-xs text-theme-muted">{label ? new Date(label).toLocaleString() : ''}</p>
          <p className="text-sm font-bold text-theme-primary">{payload[0].value.toFixed(1)}</p>
        </div>
      )
    }
    return null
  }

  // Active filters indicator
  const hasFilters = appliedBrand !== 'All' || appliedCountry !== 'All'
  const filterLabel = [
    appliedBrand !== 'All' ? appliedBrand : null,
    appliedCountry !== 'All' ? appliedCountry : null,
  ].filter(Boolean).join(' • ')

  return (
    <div className="space-y-6">
      {/* Active Filters Banner */}
      {hasFilters && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--bg-card-blue)' }}>
          <span className="text-sm text-theme-secondary">Filtered by:</span>
          <span className="pill pill-accent text-xs">{filterLabel}</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Active Sessions"
          value={overview?.active_sessions?.toLocaleString() ?? '-'}
          subtitle={label}
          trend={5.2}
          icon={<Users size={20} />}
          status="good"
        />
        <MetricCard
          title="GGR Today"
          value={`€${(overview?.ggr_today ?? 0).toLocaleString()}`}
          subtitle={`${overview?.deposits_count ?? 0} deposits`}
          trend={12.4}
          icon={<DollarSign size={20} />}
          status="good"
        />
        <MetricCard
          title="Avg Latency"
          value={`${overview?.avg_latency_ms ?? 0}ms`}
          subtitle="p95 across services"
          trend={-3.1}
          icon={<Activity size={20} />}
          status={getLatencyStatus(overview?.avg_latency_ms ?? 0)}
        />
        <MetricCard
          title="Error Rate"
          value={`${overview?.error_rate ?? 0}%`}
          subtitle="5xx errors"
          trend={0.8}
          icon={<AlertTriangle size={20} />}
          status={getErrorStatus(overview?.error_rate ?? 0)}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Latency Trend */}
        <Card>
          <SectionHeader title="Response Time" subtitle="Average latency (ms)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyTrend}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#latencyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sessions Trend */}
        <Card>
          <SectionHeader title="Active Sessions" subtitle="Concurrent users" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionsTrend}>
                <defs>
                  <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gradient-7)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--gradient-7)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--gradient-7)"
                  strokeWidth={2}
                  fill="url(#sessionsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Status Tables */}
      <div className="grid grid-cols-2 gap-6">
        {/* PSP Status */}
        <Card>
          <SectionHeader
            title="Payment Providers"
            subtitle="Success rates"
            action={<StatusBadge status="healthy" />}
          />
          <div className="space-y-3">
            {pspData?.filter(p => p.operation === 'deposit').map((psp) => {
              const successRate = (psp.success_count / psp.total_count) * 100
              const status = successRate >= 98 ? 'success' : successRate >= 95 ? 'warning' : 'brand'

              return (
                <div key={psp.psp_name} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-theme-secondary">{psp.psp_name}</div>
                  <div className="flex-1">
                    <ProgressBar
                      value={successRate}
                      color={status === 'success' ? 'emerald' : status === 'warning' ? 'amber' : 'red'}
                      showLabel
                    />
                  </div>
                  <div className="w-16 text-xs text-theme-muted text-right">
                    {psp.total_count} txns
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* API Status */}
        <Card>
          <SectionHeader
            title="API Services"
            subtitle="Error rates & latency"
            action={<StatusBadge status="healthy" />}
          />
          <div className="space-y-3">
            {apiData?.map((api) => {
              const errorRate = (api.error_count / api.request_count) * 100
              const status: 'healthy' | 'degraded' | 'down' = errorRate < 0.5 ? 'healthy' : errorRate < 2 ? 'degraded' : 'down'

              return (
                <div key={`${api.service_name}-${api.endpoint}`} className="flex items-center gap-4">
                  <div className="w-20">
                    <div className="text-sm font-medium text-theme-secondary capitalize">{api.service_name}</div>
                    <div className="text-xs text-theme-muted truncate">{api.endpoint}</div>
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-xs text-theme-muted">
                      <span className="text-theme-secondary">{api.avg_duration_ms.toFixed(0)}</span>ms avg
                    </div>
                    <div className="text-xs text-theme-muted">
                      <span className="text-theme-secondary">{api.p95_duration_ms.toFixed(0)}</span>ms p95
                    </div>
                    <div className="text-xs text-theme-muted">
                      <span className={errorRate > 1 ? 'text-[var(--gradient-4)]' : 'text-theme-secondary'}>
                        {errorRate.toFixed(2)}%
                      </span> err
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <Server className="text-[#22c55e]" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme-primary">
              {overview?.psp_success_rate?.toFixed(1)}%
            </div>
            <div className="text-xs text-theme-muted">PSP Success Rate</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(104, 131, 218, 0.1)' }}>
            <Gamepad2 style={{ color: 'var(--gradient-7)' }} size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme-primary">
              {overview?.game_success_rate?.toFixed(1)}%
            </div>
            <div className="text-xs text-theme-muted">Game Launch Rate</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(248, 175, 8, 0.1)' }}>
            <DollarSign style={{ color: 'var(--gradient-1)' }} size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme-primary">
              €{(overview?.deposits_volume ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-theme-muted">Deposit Volume</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(194, 75, 157, 0.1)' }}>
            <Activity style={{ color: 'var(--gradient-5)' }} size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme-primary">
              {overview?.deposits_count ?? 0}
            </div>
            <div className="text-xs text-theme-muted">Transactions Today</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
