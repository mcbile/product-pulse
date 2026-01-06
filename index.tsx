import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ============================================
// METRIC CARD
// ============================================

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon?: ReactNode
  status?: 'good' | 'warning' | 'critical' | 'neutral'
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  status = 'neutral',
}: MetricCardProps) {
  const statusColors = {
    good: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
    neutral: 'text-gray-400',
  }

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus
  const trendColor = trend && trend > 0 ? 'text-emerald-500' : trend && trend < 0 ? 'text-red-500' : 'text-gray-500'

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-gray-400">{title}</span>
        {icon && <span className={statusColors[status]}>{icon}</span>}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-2xl font-bold ${statusColors[status]}`}>
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
        
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon size={14} />
            <span>{Math.abs(trend).toFixed(1)}%</span>
            {trendLabel && <span className="text-gray-500">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// STATUS BADGE
// ============================================

interface StatusBadgeProps {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles = {
    healthy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    degraded: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    down: 'bg-red-500/10 text-red-500 border-red-500/20',
    unknown: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  }

  const labels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
    unknown: 'Unknown',
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      {label ?? labels[status]}
    </span>
  )
}

// ============================================
// PROGRESS BAR
// ============================================

interface ProgressBarProps {
  value: number
  max?: number
  color?: 'emerald' | 'amber' | 'red' | 'blue'
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  color = 'emerald',
  size = 'md',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  
  const colors = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  }

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-800 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${colors[color]} ${heights[size]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 w-12 text-right">
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

// ============================================
// SPARKLINE (mini chart)
// ============================================

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export function Sparkline({ data, color = '#10b981', height = 32 }: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ============================================
// SECTION HEADER
// ============================================

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ============================================
// CARD
// ============================================

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 ${paddings[padding]} ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// LOADING SKELETON
// ============================================

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <Skeleton className="h-4 w-24 mb-4" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
