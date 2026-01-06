import { 
  LayoutDashboard, 
  Activity, 
  CreditCard, 
  Server, 
  Gamepad2, 
  AlertTriangle,
  Zap
} from 'lucide-react'

type Page = 'overview' | 'vitals' | 'psp' | 'api' | 'games' | 'alerts'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
  { id: 'vitals', label: 'Web Vitals', icon: <Activity size={20} /> },
  { id: 'psp', label: 'Payments', icon: <CreditCard size={20} /> },
  { id: 'api', label: 'API Health', icon: <Server size={20} /> },
  { id: 'games', label: 'Games', icon: <Gamepad2 size={20} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={20} /> },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <Zap className="text-emerald-500 mr-2" size={24} />
        <span className="text-xl font-bold">
          <span className="text-emerald-500">Pulse</span>
          <span className="text-gray-400 text-sm ml-2">Kaasino</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors text-sm font-medium
                  ${
                    currentPage === item.id
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }
                `}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Status indicator */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Collecting metrics
        </div>
      </div>
    </aside>
  )
}
