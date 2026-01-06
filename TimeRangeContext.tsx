import { createContext, useContext, useState, ReactNode } from 'react'

type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d'

interface TimeRangeContextValue {
  range: TimeRange
  setRange: (range: TimeRange) => void
  getStartTime: () => Date
  label: string
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null)

const rangeLabels: Record<TimeRange, string> = {
  '5m': 'Last 5 minutes',
  '15m': 'Last 15 minutes',
  '1h': 'Last hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
}

const rangeMs: Record<TimeRange, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TimeRange>('1h')

  const getStartTime = () => new Date(Date.now() - rangeMs[range])

  return (
    <TimeRangeContext.Provider
      value={{
        range,
        setRange,
        getStartTime,
        label: rangeLabels[range],
      }}
    >
      {children}
    </TimeRangeContext.Provider>
  )
}

export function useTimeRange() {
  const context = useContext(TimeRangeContext)
  if (!context) {
    throw new Error('useTimeRange must be used within TimeRangeProvider')
  }
  return context
}

export const TIME_RANGES: TimeRange[] = ['5m', '15m', '1h', '6h', '24h', '7d']
