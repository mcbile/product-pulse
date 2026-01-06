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
  Cell,
} from 'recharts'
import { Gamepad2, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useTimeRange } from '../context/TimeRangeContext'
import { mockData } from '../api/client'
import { MetricCard, Card, SectionHeader, StatusBadge, ProgressBar } from '../components/ui'

const PROVIDER_COLORS: Record<string, string> = {
  'Pragmatic': '#ef4444',
  'Evolution': '#f59e0b',
  'NetEnt': '#10b981',
  'Spribe': '#3b82f6',
  'default': '#8b5cf6',
}

export function GamesPage() {
  const { getStartTime } = useTimeRange()

  const { data: gameData } = useQuery({
    queryKey: ['games', getStartTime().toISOString()],
    queryFn: () => Promise.resolve(mockData.gameHealth),
  })

  // Totals
  const totalLaunches = gameData?.reduce((sum, g) => sum + g.launch_count, 0) ?? 0
  const successfulLaunches = gameData?.reduce((sum, g) => sum + g.success_count, 0) ?? 0
  const avgLoadTime = gameData?.reduce((sum, g) => sum + g.avg_load_time_ms * g.launch_count, 0) / totalLaunches || 0
  const successRate = (successfulLaunches / totalLaunches) * 100 || 0

  const loadTimeTrend = mockData.generateTimeSeries(24, 1800, 400)
  const launchesTrend = mockData.generateTimeSeries(24, 400, 150)

  // By provider
  const byProvider = gameData?.map(g => ({
    name: g.provider,
    type: g.game_type,
    launches: g.launch_count,
    success: g.success_count,
    successRate: (g.success_count / g.launch_count) * 100,
    avgLoadTime: g.avg_load_time_ms,
    p95LoadTime: g.p95_load_time_ms,
  })) ?? []

  // By game type
  const byType = gameData?.reduce((acc, g) => {
    if (!acc[g.game_type]) {
      acc[g.game_type] = { launches: 0, success: 0, loadTime: 0 }
    }
    acc[g.game_type].launches += g.launch_count
    acc[g.game_type].success += g.success_count
    acc[g.game_type].loadTime += g.avg_load_time_ms * g.launch_count
    return acc
  }, {} as Record<string, { launches: number; success: number; loadTime: number }>)

  const typeList = Object.entries(byType ?? {}).map(([type, data]) => ({
    type,
    launches: data.launches,
    successRate: (data.success / data.launches) * 100,
    avgLoadTime: data.loadTime / data.launches,
  }))

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Launch Success"
          value={`${successRate.toFixed(1)}%`}
          subtitle={`${successfulLaunches.toLocaleString()} successful`}
          trend={0.3}
          icon={<CheckCircle size={20} />}
          status={successRate >= 99 ? 'good' : successRate >= 97 ? 'warning' : 'critical'}
        />
        <MetricCard
          title="Total Launches"
          value={totalLaunches.toLocaleString()}
          subtitle="This period"
          trend={15.2}
          icon={<Gamepad2 size={20} />}
          status="neutral"
        />
        <MetricCard
          title="Avg Load Time"
          value={`${avgLoadTime.toFixed(0)}ms`}
          subtitle="Time to play"
          trend={-4.5}
          icon={<Clock size={20} />}
          status={avgLoadTime < 2000 ? 'good' : avgLoadTime < 3500 ? 'warning' : 'critical'}
        />
        <MetricCard
          title="Failed Launches"
          value={totalLaunches - successfulLaunches}
          subtitle="Requires attention"
          icon={<XCircle size={20} />}
          status={totalLaunches - successfulLaunches > 50 ? 'critical' : totalLaunches - successfulLaunches > 20 ? 'warning' : 'good'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Load Time Trend */}
        <Card>
          <SectionHeader title="Load Time Trend" subtitle="Average (ms)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loadTimeTrend}>
                <defs>
                  <linearGradient id="loadTimeGradient" x1="0" y1="0" x2="0" y2="1">
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
                  formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Load Time']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#loadTimeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Launches by Provider */}
        <Card>
          <SectionHeader title="Launches by Provider" subtitle="Distribution" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProvider} layout="vertical">
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={11}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value.toLocaleString(), 'Launches']}
                />
                <Bar dataKey="launches" radius={[0, 4, 4, 0]}>
                  {byProvider.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PROVIDER_COLORS[entry.name] || PROVIDER_COLORS.default}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* By Game Type */}
      <Card>
        <SectionHeader title="Performance by Game Type" />
        <div className="grid grid-cols-4 gap-4">
          {typeList.map((type) => {
            const status = type.successRate >= 99 ? 'healthy'
              : type.successRate >= 97 ? 'degraded'
              : 'down'

            return (
              <div
                key={type.type}
                className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-200 capitalize">{type.type}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Launches</span>
                    <span className="text-gray-300">{type.launches.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Success Rate</span>
                    <span className="text-gray-300">{type.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Load</span>
                    <span className="text-gray-300">{type.avgLoadTime.toFixed(0)}ms</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Providers Table */}
      <Card>
        <SectionHeader title="Provider Performance" subtitle="Detailed metrics" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Launches</th>
                <th className="pb-3 font-medium">Success Rate</th>
                <th className="pb-3 font-medium">Avg Load</th>
                <th className="pb-3 font-medium">P95 Load</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.map((provider) => {
                const status = provider.successRate >= 99 ? 'healthy'
                  : provider.successRate >= 97 ? 'degraded'
                  : 'down'

                return (
                  <tr key={`${provider.name}-${provider.type}`} className="border-b border-gray-800/50">
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PROVIDER_COLORS[provider.name] || PROVIDER_COLORS.default }}
                        />
                        <span className="font-medium text-gray-300">{provider.name}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="px-2 py-1 text-xs bg-gray-800 rounded text-gray-400 capitalize">
                        {provider.type}
                      </span>
                    </td>
                    <td className="py-4 text-gray-400">
                      {provider.launches.toLocaleString()}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={provider.successRate}
                          color={provider.successRate >= 99 ? 'emerald' : provider.successRate >= 97 ? 'amber' : 'red'}
                          size="sm"
                        />
                        <span className="text-sm text-gray-300 w-14">
                          {provider.successRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-400">
                      {provider.avgLoadTime.toFixed(0)}ms
                    </td>
                    <td className="py-4 text-gray-400">
                      {provider.p95LoadTime.toFixed(0)}ms
                    </td>
                    <td className="py-4">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
