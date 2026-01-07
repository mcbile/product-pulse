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
  change?: number
  icon?: ReactNode
  status?: 'good' | 'warning' | 'critical' | 'neutral'
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  change,
  icon,
  status = 'neutral',
}: MetricCardProps) {
  const statusStyles = {
    good: 'text-[#22c55e]',
    warning: 'text-[#f59e0b]',
    critical: 'text-[var(--gradient-4)]',
    neutral: 'text-theme-primary',
  }

  // Support both trend and change props
  const trendValue = trend ?? change
  const TrendIcon = trendValue && trendValue > 0 ? TrendingUp : trendValue && trendValue < 0 ? TrendingDown : Minus
  const trendColor = trendValue && trendValue > 0 ? 'text-[#22c55e]' : trendValue && trendValue < 0 ? 'text-[var(--gradient-4)]' : 'text-theme-muted'

  return (
    <div className="card p-5 card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-theme-muted font-medium">{title}</span>
        {icon && <span className={statusStyles[status]}>{icon}</span>}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`text-2xl font-bold ${statusStyles[status]}`}>
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-theme-muted mt-1">{subtitle}</div>
          )}
        </div>

        {trendValue !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon size={14} />
            <span>{Math.abs(trendValue).toFixed(1)}%</span>
            {trendLabel && <span className="text-theme-muted">{trendLabel}</span>}
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
  status: 'healthy' | 'degraded' | 'down' | 'unknown' | 'good' | 'warning' | 'critical' | 'info'
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    healthy: 'badge-success',
    good: 'badge-success',
    degraded: 'badge-warning',
    warning: 'badge-warning',
    down: 'badge-error',
    critical: 'badge-error',
    unknown: 'badge-info',
    info: 'badge-info',
  }

  const labels: Record<string, string> = {
    healthy: 'Healthy',
    good: 'Good',
    degraded: 'Degraded',
    warning: 'Warning',
    down: 'Down',
    critical: 'Critical',
    unknown: 'Unknown',
    info: 'Info',
  }

  return (
    <span className={`badge ${styles[status]}`}>
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
  color?: 'brand' | 'success' | 'warning' | 'accent' | 'emerald' | 'amber' | 'red' | 'blue' | 'green' | 'yellow'
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  color = 'brand',
  size = 'md',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const colorClasses: Record<string, string> = {
    brand: 'progress-bar-fill-brand',
    success: 'progress-bar-fill-success',
    emerald: 'progress-bar-fill-success',
    green: 'progress-bar-fill-success',
    warning: 'progress-bar-fill-warning',
    amber: 'progress-bar-fill-warning',
    yellow: 'progress-bar-fill-warning',
    accent: 'progress-bar-fill-accent',
    blue: 'progress-bar-fill-accent',
    red: 'progress-bar-fill-brand',
  }

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`progress-bar ${heights[size]} flex-1`}>
        <div
          className={`progress-bar-fill ${colorClasses[color] || colorClasses.brand}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-theme-muted w-12 text-right">
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

export function Sparkline({ data, color = 'var(--gradient-4)', height = 32 }: SparklineProps) {
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
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--gradient-4)" />
          <stop offset="100%" stopColor="var(--gradient-5)" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color === 'brand' ? 'url(#sparklineGradient)' : color}
        strokeWidth={2}
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
        <h2 className="text-lg font-bold text-theme-primary">{title}</h2>
        {subtitle && <p className="text-sm text-theme-muted">{subtitle}</p>}
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
  hover?: boolean
}

export function Card({ children, className = '', padding = 'md', hover = false }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div className={`card ${paddings[padding]} ${hover ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// LOADING SKELETON
// ============================================

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--bg-card-alt)' }}
    />
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-4 w-24 mb-4" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ============================================
// BUTTON
// ============================================

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  }

  const sizes = {
    sm: 'text-xs py-2 px-3',
    md: '',
    lg: 'text-base py-3 px-6',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

// ============================================
// SELECT
// ============================================

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function Select({ value, onChange, options, className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`select ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// ============================================
// TABLE
// ============================================

interface TableProps {
  headers: string[]
  children: ReactNode
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ============================================
// LOADING SPINNER
// ============================================

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  )
}
