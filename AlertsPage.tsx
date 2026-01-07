import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Clock, Bell, BellOff } from 'lucide-react'
import { mockData, Alert } from './apiClient'
import { Card, SectionHeader, StatusBadge } from './ui'

const severityConfig = {
  critical: {
    color: 'text-[var(--gradient-4)]',
    bg: 'bg-[rgba(244,57,110,0.1)]',
    border: 'border-[rgba(244,57,110,0.2)]',
    icon: AlertTriangle,
  },
  warning: {
    color: 'text-[#f59e0b]',
    bg: 'bg-[rgba(245,158,11,0.1)]',
    border: 'border-[rgba(245,158,11,0.2)]',
    icon: AlertTriangle,
  },
  info: {
    color: 'text-[var(--gradient-7)]',
    bg: 'bg-[rgba(104,131,218,0.1)]',
    border: 'border-[rgba(104,131,218,0.2)]',
    icon: Bell,
  },
}

export function AlertsPage() {
  const queryClient = useQueryClient()

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => Promise.resolve(mockData.alerts),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      // In production: await api.acknowledgeAlert(alertId)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const activeAlerts = alerts?.filter(a => !a.resolved_at) ?? []
  const resolvedAlerts = alerts?.filter(a => a.resolved_at) ?? []

  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length
  const infoCount = activeAlerts.filter(a => a.severity === 'info').length

  const formatTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const config = severityConfig[alert.severity]
    const Icon = config.icon

    return (
      <div className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <Icon className={config.color} size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${config.color}`}>
                {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
              </span>
              {alert.acknowledged && (
                <span className="text-xs text-theme-muted flex items-center gap-1">
                  <CheckCircle size={12} /> Acknowledged
                </span>
              )}
            </div>

            <p className="text-sm text-theme-secondary mb-2">{alert.message}</p>

            <div className="flex items-center gap-4 text-xs text-theme-muted">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatTime(alert.time)}
              </span>
              <span>
                Source: <code className="text-theme-secondary">{alert.source_table}</code>
              </span>
              <span>
                Threshold: <span className="text-theme-secondary">{alert.threshold_value}</span>
                {' → '}
                Actual: <span className={config.color}>{alert.actual_value.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {!alert.acknowledged && !alert.resolved_at && (
            <button
              onClick={() => acknowledgeMutation.mutate(alert.time)}
              className="btn btn-secondary text-xs"
            >
              Acknowledge
            </button>
          )}

          {alert.resolved_at && (
            <span className="px-3 py-1.5 text-xs bg-[rgba(34,197,94,0.1)] text-[#22c55e] rounded-lg">
              Resolved
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(244, 57, 110, 0.1)' }}>
            <AlertTriangle style={{ color: 'var(--gradient-4)' }} size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--gradient-4)' }}>{criticalCount}</div>
            <div className="text-xs text-theme-muted">Critical Alerts</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <AlertTriangle className="text-[#f59e0b]" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#f59e0b]">{warningCount}</div>
            <div className="text-xs text-theme-muted">Warnings</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(104, 131, 218, 0.1)' }}>
            <Bell style={{ color: 'var(--gradient-7)' }} size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: 'var(--gradient-7)' }}>{infoCount}</div>
            <div className="text-xs text-theme-muted">Info</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <CheckCircle className="text-[#22c55e]" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#22c55e]">{resolvedAlerts.length}</div>
            <div className="text-xs text-theme-muted">Resolved Today</div>
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card padding="none">
        <div className="p-5 border-b border-theme">
          <SectionHeader
            title="Active Alerts"
            subtitle={`${activeAlerts.length} alerts requiring attention`}
            action={
              activeAlerts.length > 0 ? (
                <button className="text-xs text-[#22c55e] hover:underline">
                  Acknowledge all
                </button>
              ) : undefined
            }
          />
        </div>

        {activeAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <BellOff className="mx-auto text-theme-muted mb-3" size={48} />
            <p className="text-theme-muted">No active alerts</p>
            <p className="text-sm text-theme-muted opacity-70">All systems operating normally</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {activeAlerts
              .sort((a, b) => {
                const order = { critical: 0, warning: 1, info: 2 }
                return order[a.severity] - order[b.severity]
              })
              .map((alert, i) => (
                <AlertCard key={`${alert.time}-${i}`} alert={alert} />
              ))}
          </div>
        )}
      </Card>

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <Card padding="none">
          <div className="p-5 border-b border-theme">
            <SectionHeader
              title="Recently Resolved"
              subtitle="Alerts resolved in the last 24 hours"
            />
          </div>

          <div className="p-5 space-y-3">
            {resolvedAlerts.map((alert, i) => (
              <AlertCard key={`resolved-${alert.time}-${i}`} alert={alert} />
            ))}
          </div>
        </Card>
      )}

      {/* Alert Rules */}
      <Card>
        <SectionHeader
          title="Alert Rules"
          subtitle="Configured thresholds"
          action={
            <button className="text-xs text-[#22c55e] hover:underline">
              Configure →
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-theme-muted border-b border-theme">
                <th className="pb-3 font-medium">Rule</th>
                <th className="pb-3 font-medium">Metric</th>
                <th className="pb-3 font-medium">Condition</th>
                <th className="pb-3 font-medium">Threshold</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { rule: 'PSP Degraded', metric: 'psp_success_rate', condition: '<', threshold: '95%', severity: 'warning' },
                { rule: 'PSP Down', metric: 'psp_success_rate', condition: '<', threshold: '90%', severity: 'critical' },
                { rule: 'High Latency', metric: 'api_p95_latency', condition: '>', threshold: '500ms', severity: 'warning' },
                { rule: 'Error Spike', metric: 'api_error_rate', condition: '>', threshold: '1%', severity: 'critical' },
                { rule: 'Game Launch Issues', metric: 'game_success_rate', condition: '<', threshold: '97%', severity: 'warning' },
              ].map((rule) => (
                <tr key={rule.rule} className="border-b border-theme">
                  <td className="py-3 text-sm text-theme-secondary">{rule.rule}</td>
                  <td className="py-3">
                    <code className="text-xs px-2 py-1 rounded text-theme-muted" style={{ background: 'var(--bg-card-alt)' }}>
                      {rule.metric}
                    </code>
                  </td>
                  <td className="py-3 text-sm text-theme-muted">{rule.condition}</td>
                  <td className="py-3 text-sm text-theme-secondary">{rule.threshold}</td>
                  <td className="py-3">
                    <span className={`
                      px-2 py-1 text-xs rounded-full
                      ${rule.severity === 'critical'
                        ? 'bg-[rgba(244,57,110,0.1)] text-[var(--gradient-4)]'
                        : 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]'
                      }
                    `}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="py-3">
                    <StatusBadge status="healthy" label="Active" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
