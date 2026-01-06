/**
 * KAASINO PULSE - React Integration
 * 
 * Usage:
 *   import { PulseProvider, usePulse } from '@kaasino/pulse-sdk/react'
 *   
 *   // In App.tsx
 *   <PulseProvider config={{ endpoint: '...', siteId: '...' }}>
 *     <App />
 *   </PulseProvider>
 *   
 *   // In components
 *   const { track, interaction, error } = usePulse()
 */

import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Pulse, PulseSDK, type PulseConfig } from './index'

// ============================================
// CONTEXT
// ============================================

interface PulseContextValue {
  track: (name: string, value: number, metadata?: Record<string, unknown>) => void
  interaction: (name: string, metadata?: Record<string, unknown>) => void
  error: (error: Error | string, metadata?: Record<string, unknown>) => void
  flush: () => Promise<void>
}

const PulseContext = createContext<PulseContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

interface PulseProviderProps {
  config: PulseConfig
  children: ReactNode
}

export function PulseProvider({ config, children }: PulseProviderProps): JSX.Element {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      Pulse.init(config)
      initialized.current = true
    }

    return () => {
      Pulse.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const track = useCallback((name: string, value: number, metadata?: Record<string, unknown>) => {
    Pulse.track(name, value, metadata)
  }, [])

  const interaction = useCallback((name: string, metadata?: Record<string, unknown>) => {
    Pulse.interaction(name, metadata)
  }, [])

  const error = useCallback((err: Error | string, metadata?: Record<string, unknown>) => {
    Pulse.error(err, metadata)
  }, [])

  const flush = useCallback(() => Pulse.flush(), [])

  return (
    <PulseContext.Provider value={{ track, interaction, error, flush }}>
      {children}
    </PulseContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function usePulse(): PulseContextValue {
  const context = useContext(PulseContext)
  if (!context) {
    throw new Error('usePulse must be used within PulseProvider')
  }
  return context
}

// ============================================
// TRACKING HOOKS
// ============================================

/**
 * Track component render time
 */
export function useRenderTime(componentName: string): void {
  const startTime = useRef(performance.now())

  useEffect(() => {
    const renderTime = performance.now() - startTime.current
    Pulse.track('component_render', renderTime, { component: componentName })
  }, [componentName])
}

/**
 * Track component mount/unmount
 */
export function useComponentLifecycle(componentName: string): void {
  useEffect(() => {
    Pulse.interaction('component_mount', { component: componentName })
    return () => {
      Pulse.interaction('component_unmount', { component: componentName })
    }
  }, [componentName])
}

/**
 * Track async operation duration
 */
export function useTrackAsync<T>(
  name: string,
  asyncFn: () => Promise<T>,
  deps: unknown[] = []
): () => Promise<T> {
  return useCallback(async () => {
    const start = performance.now()
    try {
      const result = await asyncFn()
      Pulse.track(name, performance.now() - start, { success: true })
      return result
    } catch (err) {
      Pulse.track(name, performance.now() - start, { success: false })
      Pulse.error(err as Error, { operation: name })
      throw err
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Track button/link clicks
 */
export function useTrackClick(
  name: string,
  metadata?: Record<string, unknown>
): () => void {
  return useCallback(() => {
    Pulse.interaction(name, metadata)
  }, [name, metadata])
}

// ============================================
// ERROR BOUNDARY
// ============================================

interface PulseErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface PulseErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class PulseErrorBoundary extends React.Component<
  PulseErrorBoundaryProps,
  PulseErrorBoundaryState
> {
  constructor(props: PulseErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): PulseErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    Pulse.error(error, {
      componentStack: errorInfo.componentStack,
      type: 'react_error_boundary',
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong</div>
    }
    return this.props.children
  }
}

// Re-export React for ErrorBoundary
import * as React from 'react'
