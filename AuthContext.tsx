import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeContext'

// Google Client ID - замени на свой из Google Cloud Console
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'

// API Base URL for backend authentication
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Разрешённые домены для авторизации
const ALLOWED_DOMAINS = ['starcrown.partners']

interface User {
  email: string
  name: string
  nickname?: string
  picture: string
  role: 'super_admin' | 'admin' | 'client'
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authError: string | null
  logout: () => void
}

function isAllowedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_DOMAINS.includes(domain)
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Auth API functions
async function apiLogin(login: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Login failed' }
    }
    return { success: true, token: data.token, user: data.user }
  } catch (err) {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

async function apiVerify(token: string): Promise<{ valid: boolean; user?: User }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { valid: false }
    const data = await res.json()
    return { valid: data.valid, user: data.user }
  } catch {
    return { valid: false }
  }
}

async function apiLogout(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Ignore logout errors
  }
}

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Check for saved session token and verify with backend
    const token = localStorage.getItem('pulse-token')
    if (token) {
      apiVerify(token).then(result => {
        if (result.valid && result.user) {
          setUser(result.user)
        } else {
          // Token invalid or expired - clear storage
          localStorage.removeItem('pulse-token')
          localStorage.removeItem('pulse-user')
        }
        setIsLoading(false)
      })
    } else {
      // Fallback: check for legacy pulse-user (Google OAuth only)
      const savedUser = localStorage.getItem('pulse-user')
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser)
          if (isAllowedEmail(parsed.email)) {
            setUser(parsed)
          } else {
            localStorage.removeItem('pulse-user')
          }
        } catch {
          localStorage.removeItem('pulse-user')
        }
      }
      setIsLoading(false)
    }
  }, [])

  const logout = () => {
    const token = localStorage.getItem('pulse-token')
    if (token) {
      apiLogout(token)
    }
    googleLogout()
    setUser(null)
    setAuthError(null)
    localStorage.removeItem('pulse-token')
    localStorage.removeItem('pulse-user')
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, authError, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </GoogleOAuthProvider>
  )
}

// Login Page Component
export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [login, setLogin] = useState('') // email or nickname for login
  const [email, setEmail] = useState('') // username part only (without @domain)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await apiLogin(login, password)

      if (result.success && result.token && result.user) {
        localStorage.setItem('pulse-token', result.token)
        localStorage.setItem('pulse-user', JSON.stringify(result.user))
        window.location.reload()
      } else {
        setError(result.error || 'Invalid email/nickname or password')
      }
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate nickname
    if (!nickname.trim()) {
      setError('Nickname is required')
      return
    }

    if (nickname.trim().length < 3) {
      setError('Nickname must be at least 3 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nickname.trim())) {
      setError('Nickname can only contain letters, numbers and underscore')
      return
    }

    // Validate email (username part only)
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(email.trim())) {
      setError('Email can only contain letters, numbers, dots, dashes and underscores')
      return
    }

    // Validate password
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least 1 uppercase letter')
      return
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least 1 lowercase letter')
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least 1 number')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // TODO: Backend registration not implemented yet
    // For now, show message to contact admin
    setError('Registration is currently disabled. Please contact admin.')
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (credentialResponse.credential) {
      setError(null)
      setIsSubmitting(true)

      try {
        // Send Google credential to backend for verification and session creation
        const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: credentialResponse.credential }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Google login failed')
          setIsSubmitting(false)
          return
        }

        if (data.success && data.token && data.user) {
          // Save session token and user data
          localStorage.setItem('pulse-token', data.token)
          localStorage.setItem('pulse-user', JSON.stringify(data.user))
          window.location.reload()
        } else {
          setError('Google login failed. Please try again.')
        }
      } catch (err) {
        setError('Network error. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const resetForm = () => {
    setLogin('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setNickname('')
    setError(null)
  }

  const switchMode = (newMode: 'login' | 'register') => {
    resetForm()
    setMode(newMode)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-xl bg-brand flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-extrabold text-3xl">M</span>
        </div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">Product Pulse</h1>
        <p className="text-theme-muted mb-8">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ background: 'rgba(244, 57, 110, 0.1)', color: 'var(--gradient-4)' }}>
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Email or Nickname"
              required
              className="w-full px-4 py-3 rounded-lg border border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 rounded-lg border border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
            />
            <button type="submit" className="w-full btn btn-primary py-3" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname (for login)"
              required
              className="w-full px-4 py-3 rounded-lg border border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
            />
            <div className="flex">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/@.*$/, ''))}
                placeholder="username"
                required
                className="flex-1 px-4 py-3 rounded-l-lg border border-r-0 border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
              />
              <span className="px-4 py-3 rounded-r-lg border border-theme bg-[var(--bg-card-alt)] text-theme-muted text-sm flex items-center">
                @starcrown.partners
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              required
              className="w-full px-4 py-3 rounded-lg border border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
              className="w-full px-4 py-3 rounded-lg border border-theme bg-transparent text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-brand"
            />
            <button type="submit" className="w-full btn btn-primary py-3">
              Create Account
            </button>
          </form>
        )}

        <div className="mb-6">
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm text-theme-muted hover:text-brand transition-colors"
          >
            {mode === 'login' ? (
              <>Don't have an account? <span style={{ color: '#F4396E' }}>Register</span></>
            ) : (
              'Already have an account? Sign In'
            )}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-theme"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 text-theme-muted" style={{ background: 'var(--bg-card)' }}>or</span>
          </div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Login failed. Please try again.')}
            theme="filled_black"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <p className="text-xs text-theme-muted mt-6">
          Only @starcrown.partners emails are allowed
        </p>
      </div>
    </div>
  )
}

// Default Avatar Component
function DefaultAvatar({ email, role, size = 32 }: { email: string; role?: string; size?: number }) {
  const letter = email.charAt(0).toUpperCase()

  // Background color based on role
  const getBgColor = () => {
    switch (role) {
      case 'super_admin': return '#a855f7' // purple-500
      case 'admin': return '#3b82f6' // blue-500
      default: return '#10b981' // emerald-500
    }
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: getBgColor(),
        fontSize: size * 0.45,
      }}
    >
      {letter}
    </div>
  )
}

// Theme Toggle Button for User Menu
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-theme-secondary hover:bg-[var(--bg-card-alt)] rounded-lg transition-colors"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}

// User Menu Component
export function UserMenu() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="w-8 h-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <DefaultAvatar email={user.email} role={user.role} size={32} />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 card p-3 min-w-[200px]">
            <div className="flex items-center gap-3 pb-3 border-b border-theme mb-2">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <DefaultAvatar email={user.email} role={user.role} size={40} />
              )}
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-theme-primary truncate">{user.name}</span>
                  {user.role === 'super_admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500 font-medium">super</span>
                  )}
                  {user.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-medium">admin</span>
                  )}
                  {user.role === 'client' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-medium">client</span>
                  )}
                </div>
                <div className="text-xs text-theme-muted truncate">{user.email}</div>
              </div>
            </div>
            <ThemeToggleButton />
            <div className="border-t border-theme my-2"></div>
            <button
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-theme-secondary hover:bg-[var(--bg-card-alt)] rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
