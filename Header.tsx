import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTimeRange, TIME_RANGES } from '../context/TimeRangeContext'

export function Header() {
  const { range, setRange } = useTimeRange()
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-200">Performance Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Time range selector */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${
                  range === r
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </header>
  )
}
