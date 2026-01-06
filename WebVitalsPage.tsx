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
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { useTimeRange } from '../context/TimeRangeContext'
import { mockData } from '../api/client'
import { MetricCard, Card, SectionHeader, StatusBadge, ProgressBar } from '../components/ui'

// Web Vitals thresholds (Google standards)
const thresholds = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  ttfb: { good: 800, poor: 1800 },
  fcp: { good: 1800, poor: 3000 },
}

function getVitalStatus(value: number, metric: keyof typeof thresholds): 'good' | 'warning' | 'critical' {
  const t = thresholds[metric]
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'warning'
  return 'critical'
}

function getVitalColor(status: 'good' | 'warning' | 'critical'): string {
  return status === 'good' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444'
}

export function WebVitalsPage() {
  const { getStartTime } = useTimeRange()

  const { data: vitalsData } = useQuery({
    queryKey: ['vitals', getStartTime().toISOString()],
    queryFn: () => Promise.resolve(mockData.webVitals),
  })

  // Aggregate by device type
  const aggregated = vitalsData?.reduce((acc, v) => {
    if (!acc[v.device_type]) {
      acc[v.device_type] = { samples: 0, lcp: 0, fid: 0, cls: 0, inp: 0 }
    }
    acc[v.device_type].samples += v.sample_count
    acc[v.device_type].lcp += v.p75_lcp_ms * v.sample_count
    acc[v.device_type].fid += v.p75_fid_ms * v.sample_count
    acc[v.device_type].cls += v.p75_cls * v.sample_count
    acc[v.device_type].inp += v.p75_inp_ms * v.sample_count
    return acc
  }, {} as Record<string, { samples: number; lcp: number; fid: number; cls: number; inp: number }>)

  // Calculate weighted averages
  const deviceMetrics = Object.entries(aggregated ?? {}).map(([device, data]) => ({
    device,
    lcp: data.lcp / data.samples,
    fid: data.fid / data.samples,
    cls: data.cls / data.samples,
    inp: data.inp / data.samples,
    samples: data.samples,
  }))

  // Overall metrics (weighted by samples)
  const totalSamples = deviceMetrics.reduce((sum, d) => sum + d.samples, 0)
  const overall = {
    lcp: deviceMetrics.reduce((sum, d) => sum + d.lcp * d.samples, 0) / totalSamples || 0,
    fid: deviceMetrics.reduce((sum, d) => sum + d.fid * d.samples, 0) / totalSamples || 0,
    cls: deviceMetrics.reduce((sum, d) => sum + d.cls * d.samples, 0) / totalSamples || 0,
    inp: deviceMetrics.reduce((sum, d) => sum + d.inp * d.samples, 0) / totalSamples || 0,
  }

  const lcpTrend = mockData.generateTimeSeries(24, 2200, 600)
  const clsTrend = mockData.generateTimeSeries(24, 0.08, 0.04)

  const DeviceIcon = ({ type }: { type: string }) => {
    if (type === 'mobile') return <Smartphone size={18} />
    if (type === 'tablet') return <Tablet size={18} />
    return <Monitor size={18} />
  }

  return (
    <div className="space-y-6">
      {/* Core Web Vitals */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="LCP (p75)"
          value={`${overall.lcp.toFixed(0)}ms`}
          subtitle="Largest Contentful Paint"
          status={getVitalStatus(overall.lcp, 'lcp')}
        />
        <MetricCard
          title="FID (p75)"
          value={`${overall.fid.toFixed(0)}ms`}
          subtitle="First Input Delay"
          status={getVitalStatus(overall.fid, 'fid')}
        />
        <MetricCard
          title="CLS (p75)"
          value={overall.cls.toFixed(3)}
          subtitle="Cumulative Layout Shift"
          status={getVitalStatus(overall.cls, 'cls')}
        />
        <MetricCard
          title="INP (p75)"
          value={`${overall.inp.toFixed(0)}ms`}
          subtitle="Interaction to Next Paint"
          status={getVitalStatus(overall.inp, 'inp')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* LCP Trend */}
        <Card>
          <SectionHeader title="LCP Trend" subtitle="Largest Contentful Paint (ms)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lcpTrend}>
                <defs>
                  <linearGradient id="lcpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Threshold lines */}
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="#6b7280"
                  fontSize={11}
                />
                <YAxis stroke="#6b7280" fontSize={11} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(0)}ms`, 'LCP']}
                />
                {/* Good threshold */}
                <Area
                  type="monotone"
                  dataKey={() => thresholds.lcp.good}
                  stroke="#10b981"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#lcpGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500" /> Good: ≤2.5s
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-500" /> Needs improvement: ≤4s
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-500" /> Poor: &gt;4s
            </span>
          </div>
        </Card>

        {/* CLS Trend */}
        <Card>
          <SectionHeader title="CLS Trend" subtitle="Cumulative Layout Shift" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={clsTrend}>
                <defs>
                  <linearGradient id="clsGradient" x1="0" y1="0" x2="0" y2="1">
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
                <YAxis stroke="#6b7280" fontSize={11} domain={[0, 0.3]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(3), 'CLS']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#clsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500" /> Good: ≤0.1
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-500" /> Needs improvement: ≤0.25
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-500" /> Poor: &gt;0.25
            </span>
          </div>
        </Card>
      </div>

      {/* By Device Type */}
      <Card>
        <SectionHeader title="Performance by Device" subtitle="Core Web Vitals breakdown" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-3 font-medium">Device</th>
                <th className="pb-3 font-medium">Samples</th>
                <th className="pb-3 font-medium">LCP (p75)</th>
                <th className="pb-3 font-medium">FID (p75)</th>
                <th className="pb-3 font-medium">CLS (p75)</th>
                <th className="pb-3 font-medium">INP (p75)</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {deviceMetrics.map((d) => {
                const lcpStatus = getVitalStatus(d.lcp, 'lcp')
                const fidStatus = getVitalStatus(d.fid, 'fid')
                const clsStatus = getVitalStatus(d.cls, 'cls')
                const inpStatus = getVitalStatus(d.inp, 'inp')
                
                // Overall status is worst of all
                const statuses = [lcpStatus, fidStatus, clsStatus, inpStatus]
                const overallStatus = statuses.includes('critical')
                  ? 'down'
                  : statuses.includes('warning')
                  ? 'degraded'
                  : 'healthy'

                return (
                  <tr key={d.device} className="border-b border-gray-800/50">
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-gray-300">
                        <DeviceIcon type={d.device} />
                        <span className="capitalize">{d.device}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-400">{d.samples.toLocaleString()}</td>
                    <td className="py-4">
                      <span style={{ color: getVitalColor(lcpStatus) }}>
                        {d.lcp.toFixed(0)}ms
                      </span>
                    </td>
                    <td className="py-4">
                      <span style={{ color: getVitalColor(fidStatus) }}>
                        {d.fid.toFixed(0)}ms
                      </span>
                    </td>
                    <td className="py-4">
                      <span style={{ color: getVitalColor(clsStatus) }}>
                        {d.cls.toFixed(3)}
                      </span>
                    </td>
                    <td className="py-4">
                      <span style={{ color: getVitalColor(inpStatus) }}>
                        {d.inp.toFixed(0)}ms
                      </span>
                    </td>
                    <td className="py-4">
                      <StatusBadge status={overallStatus} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* By Page */}
      <Card>
        <SectionHeader title="Performance by Page" subtitle="Top pages by traffic" />
        <div className="space-y-4">
          {vitalsData?.slice(0, 6).map((v, i) => (
            <div key={`${v.page_path}-${v.device_type}-${i}`} className="flex items-center gap-4">
              <div className="w-48">
                <div className="text-sm text-gray-300 truncate">{v.page_path}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <DeviceIcon type={v.device_type} />
                  {v.device_type}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">LCP</span>
                  <div style={{ color: getVitalColor(getVitalStatus(v.p75_lcp_ms, 'lcp')) }}>
                    {v.p75_lcp_ms.toFixed(0)}ms
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">FID</span>
                  <div style={{ color: getVitalColor(getVitalStatus(v.p75_fid_ms, 'fid')) }}>
                    {v.p75_fid_ms.toFixed(0)}ms
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">CLS</span>
                  <div style={{ color: getVitalColor(getVitalStatus(v.p75_cls, 'cls')) }}>
                    {v.p75_cls.toFixed(3)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">INP</span>
                  <div style={{ color: getVitalColor(getVitalStatus(v.p75_inp_ms, 'inp')) }}>
                    {v.p75_inp_ms.toFixed(0)}ms
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {v.sample_count.toLocaleString()} samples
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
