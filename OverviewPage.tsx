import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { Users, DollarSign, Activity, AlertTriangle, Server, Gamepad2 } from 'lucide-react'
import { useTimeRange } from '../context/TimeRangeContext'
import { mockData } from '../api/client'
import { MetricCard, Card, SectionHeader, StatusBadge, ProgressBar } from '../components/ui'

export function OverviewPage() {
  const { getStartTime, label } = useTimeRange()

  // In production, replace mockData with actual API calls
  const { data: overview } = useQuery({
    queryKey: ['overview', getStartTime().toISOString()],
    queryFn: () => Promise.resolve(mockData.overview),
  })

  const { data: pspData } = useQuery({
    queryKey: ['psp-overview', getStartTime().toISOString()],
    queryFn: () => Promise.resolve(mockData.pspHealth),
  })

  const { data: apiData } = useQuery({
    queryKey: ['api-overview', getStartTime().toISOString()],
    queryFn: () => Promise.resolve(mockData.apiPerformance),
  })

  const latencyTrend = mockData.generateTimeSeries(24, 150, 50)
  const sessionsTrend = mockData.generateTimeSeries(24, 1200, 300)

  const getLatencyStatus = (ms: number) => {
    if (ms < 200) return 'good'
    if (ms < 500) return 'warning'
    return 'critical'
  }

  const getErrorStatus = (rate: number) => {
    if (rate < 0.5) return 'good'
    if (rate < 2) return 'warning'
    return 'critical'
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Active Sessions"
          value={overview?.active_sessions.toLocaleString() ?? '-'}
          subtitle={label}
          trend={5.2}
          icon={<Users size={20} />}
          status="good"
        />
        <MetricCard
          title="GGR Today"
          value={`$${(overview?.ggr_today ?? 0).toLocaleString()}`}
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
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="#6b7280"
                  fontSize={11}
                />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Latency']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="#6b7280"
                  fontSize={11}
                />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(0), 'Sessions']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
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
              const status = successRate >= 98 ? 'good' : successRate >= 95 ? 'warning' : 'critical'
              
              return (
                <div key={psp.psp_name} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-300">{psp.psp_name}</div>
                  <div className="flex-1">
                    <ProgressBar
                      value={successRate}
                      color={status === 'good' ? 'emerald' : status === 'warning' ? 'amber' : 'red'}
                      showLabel
                    />
                  </div>
                  <div className="w-16 text-xs text-gray-500 text-right">
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
              const status = errorRate < 0.5 ? 'healthy' : errorRate < 2 ? 'degraded' : 'down'
              
              return (
                <div key={`${api.service_name}-${api.endpoint}`} className="flex items-center gap-4">
                  <div className="w-20">
                    <div className="text-sm font-medium text-gray-300 capitalize">{api.service_name}</div>
                    <div className="text-xs text-gray-500 truncate">{api.endpoint}</div>
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-300">{api.avg_duration_ms.toFixed(0)}</span>ms avg
                    </div>
                    <div className="text-xs text-gray-400">
                      <span className="text-gray-300">{api.p95_duration_ms.toFixed(0)}</span>ms p95
                    </div>
                    <div className="text-xs text-gray-400">
                      <span className={errorRate > 1 ? 'text-red-400' : 'text-gray-300'}>
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
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <Server className="text-emerald-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-200">
              {overview?.psp_success_rate?.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">PSP Success Rate</div>
          </div>
        </Card>
        
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Gamepad2 className="text-blue-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-200">
              {overview?.game_success_rate?.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Game Launch Rate</div>
          </div>
        </Card>
        
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <DollarSign className="text-amber-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-200">
              ${(overview?.deposits_volume ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Deposit Volume</div>
          </div>
        </Card>
        
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <Activity className="text-purple-500" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-200">
              {overview?.deposits_count ?? 0}
            </div>
            <div className="text-xs text-gray-500">Transactions Today</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
