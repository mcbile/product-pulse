import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, createContext, useContext, ReactNode } from 'react'
import { Sun, Moon, LayoutDashboard, Activity, CreditCard, Server, Gamepad2, Bell, Download, Filter } from 'lucide-react'
import { ThemeProvider, useTheme } from './ThemeContext'
import { TimeRangeProvider, useTimeRange, TIME_RANGES } from './TimeRangeContext'

// Filters
const BRANDS = ['All', 'Kaasino', 'Bet4star'] as const
const COUNTRIES = ['All', 'NL', 'GB', 'DE', 'N/A'] as const

type Brand = typeof BRANDS[number]
type Country = typeof COUNTRIES[number]

interface FiltersContextType {
  brand: Brand
  setBrand: (b: Brand) => void
  country: Country
  setCountry: (c: Country) => void
  appliedBrand: Brand
  appliedCountry: Country
  applyFilters: () => void
  filtersChanged: boolean
}

const FiltersContext = createContext<FiltersContextType | null>(null)

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>('All')
  const [country, setCountry] = useState<Country>('All')
  const [appliedBrand, setAppliedBrand] = useState<Brand>('All')
  const [appliedCountry, setAppliedCountry] = useState<Country>('All')

  const filtersChanged = brand !== appliedBrand || country !== appliedCountry

  const applyFilters = () => {
    setAppliedBrand(brand)
    setAppliedCountry(country)
  }

  return (
    <FiltersContext.Provider value={{
      brand, setBrand, country, setCountry,
      appliedBrand, appliedCountry, applyFilters, filtersChanged
    }}>
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider')
  return ctx
}
import { OverviewPage } from './OverviewPage'
import { WebVitalsPage } from './WebVitalsPage'
import { PSPPage } from './PSPPage'
import { APIPage } from './APIPage'
import { GamesPage } from './GamesPage'
import { AlertsPage } from './AlertsPage'
import { mockData } from './apiClient'

const queryClient = new QueryClient()

type Page = 'overview' | 'vitals' | 'psp' | 'api' | 'games' | 'alerts'

const pageConfig: Record<Page, { label: string; icon: React.ReactNode }> = {
  overview: { label: 'Overview', icon: <LayoutDashboard size={18} /> },
  vitals: { label: 'Web Vitals', icon: <Activity size={18} /> },
  psp: { label: 'PSP', icon: <CreditCard size={18} /> },
  api: { label: 'API', icon: <Server size={18} /> },
  games: { label: 'Games', icon: <Gamepad2 size={18} /> },
  alerts: { label: 'Alerts', icon: <Bell size={18} /> },
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

function TimeRangeSelector() {
  const { range, setRange } = useTimeRange()

  return (
    <select
      value={range}
      onChange={(e) => setRange(e.target.value as typeof range)}
      className="select"
    >
      {TIME_RANGES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

function BrandSelector() {
  const { brand, setBrand } = useFilters()

  return (
    <select
      value={brand}
      onChange={(e) => setBrand(e.target.value as Brand)}
      className="select"
    >
      {BRANDS.map((b) => (
        <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>
      ))}
    </select>
  )
}

function CountrySelector() {
  const { country, setCountry } = useFilters()

  return (
    <select
      value={country}
      onChange={(e) => setCountry(e.target.value as Country)}
      className="select"
    >
      {COUNTRIES.map((c) => (
        <option key={c} value={c}>{c === 'All' ? 'All Countries' : c}</option>
      ))}
    </select>
  )
}

function ApplyFiltersButton() {
  const { applyFilters, filtersChanged } = useFilters()

  return (
    <button
      onClick={applyFilters}
      disabled={!filtersChanged}
      className={`btn ${filtersChanged ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
    >
      <Filter size={16} />
      Apply
    </button>
  )
}

// Export utilities
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return val
    }).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

function exportToMarkdown(data: Record<string, unknown>[], title: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const mdContent = [
    `# ${title}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...data.map(row => '| ' + headers.map(h => row[h]).join(' | ') + ' |')
  ].join('\n')

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.md`
  link.click()
}

function ExportMenu({ currentPage }: { currentPage: Page }) {
  const [isOpen, setIsOpen] = useState(false)

  const getExportData = () => {
    switch (currentPage) {
      case 'overview':
        return { data: [mockData.overview], title: 'Overview Metrics' }
      case 'psp':
        return { data: mockData.pspHealth, title: 'PSP Health' }
      case 'api':
        return { data: mockData.apiPerformance, title: 'API Performance' }
      case 'games':
        return { data: mockData.gameProviders, title: 'Game Providers' }
      case 'vitals':
        return {
          data: Object.entries(mockData.webVitals).map(([key, val]) => ({ metric: key, ...val })),
          title: 'Web Vitals'
        }
      case 'alerts':
        return { data: mockData.alerts, title: 'Alerts' }
      default:
        return { data: [], title: 'Export' }
    }
  }

  const handleExport = (format: 'csv' | 'md') => {
    const { data, title } = getExportData()
    if (format === 'csv') {
      exportToCSV(data as Record<string, unknown>[], title)
    } else {
      exportToMarkdown(data as Record<string, unknown>[], title)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary flex items-center gap-2"
      >
        <Download size={16} />
        Export
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 card p-2 min-w-[120px]">
            <button
              onClick={() => handleExport('csv')}
              className="w-full text-left px-3 py-2 text-sm text-theme-secondary hover:bg-card-alt rounded-lg transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport('md')}
              className="w-full text-left px-3 py-2 text-sm text-theme-secondary hover:bg-card-alt rounded-lg transition-colors"
            >
              Export Markdown
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Dashboard() {
  const [currentPage, setCurrentPage] = useState<Page>('overview')

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <OverviewPage />
      case 'vitals': return <WebVitalsPage />
      case 'psp': return <PSPPage />
      case 'api': return <APIPage />
      case 'games': return <GamesPage />
      case 'alerts': return <AlertsPage />
      default: return <OverviewPage />
    }
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="sidebar w-64 p-4 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <span className="text-white font-extrabold text-2xl">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-brand font-bold text-xl leading-tight">Pulse View</span>
            <span className="text-theme-muted text-[10px] uppercase tracking-widest font-medium">Monitoring</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 flex-1">
          {(Object.keys(pageConfig) as Page[]).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`sidebar-item w-full text-left ${currentPage === page ? 'active' : ''}`}
            >
              {pageConfig[page].icon}
              <span>{pageConfig[page].label}</span>
            </button>
          ))}
        </nav>

        {/* Status Indicators */}
        <div className="pt-4 border-t border-theme mt-auto space-y-2">
          <div className="flex items-center justify-between px-2">
            <div className="badge badge-success">
              <span className="status-dot status-dot-success"></span>
              System OK
            </div>
            <div className="badge badge-info">
              <span className="status-dot" style={{ background: 'var(--gradient-7)' }}></span>
              Live
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-theme-primary">
              {pageConfig[currentPage].label}
            </h2>
            <p className="text-theme-muted text-sm mt-1">
              Real-time performance monitoring
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <BrandSelector />
            <CountrySelector />
            <TimeRangeSelector />
            <ApplyFiltersButton />
            <ExportMenu currentPage={currentPage} />
            <ThemeToggle />
          </div>
        </div>

        {/* Page Content */}
        {renderPage()}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TimeRangeProvider>
          <FiltersProvider>
            <Dashboard />
          </FiltersProvider>
        </TimeRangeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
