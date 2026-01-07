import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getInitialTheme(): Theme {
  // Check if we're in browser
  if (typeof window === 'undefined') return 'dark'

  try {
    // Check localStorage first
    const saved = localStorage.getItem('pulse-theme')
    if (saved === 'light' || saved === 'dark') return saved

    // Check system preference
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  } catch {
    // localStorage might be blocked
  }

  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Apply theme on mount and changes
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)

    try {
      localStorage.setItem('pulse-theme', theme)
    } catch {
      // localStorage might be blocked
    }

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f0f12' : '#FFFFFF')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      console.log('Theme toggled:', prev, '->', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
