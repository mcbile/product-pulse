import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { OverviewPage } from './pages/OverviewPage'
import { WebVitalsPage } from './pages/WebVitalsPage'
import { PSPPage } from './pages/PSPPage'
import { APIPage } from './pages/APIPage'
import { GamesPage } from './pages/GamesPage'
import { AlertsPage } from './pages/AlertsPage'
import { TimeRangeProvider } from './context/TimeRangeContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 30000, // 30s auto-refresh
      staleTime: 10000,
      retry: 2,
    },
  },
})

type Page = 'overview' | 'vitals' | 'psp' | 'api' | 'games' | 'alerts'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('overview')

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />
      case 'vitals':
        return <WebVitalsPage />
      case 'psp':
        return <PSPPage />
      case 'api':
        return <APIPage />
      case 'games':
        return <GamesPage />
      case 'alerts':
        return <AlertsPage />
      default:
        return <OverviewPage />
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TimeRangeProvider>
        <div className="flex h-screen bg-gray-950 text-gray-100">
          <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              {renderPage()}
            </main>
          </div>
        </div>
      </TimeRangeProvider>
    </QueryClientProvider>
  )
}
