/**
 * KAASINO PULSE SDK
 * Lightweight performance monitoring (~2.5KB gzipped)
 * 
 * Usage:
 *   import { Pulse } from '@kaasino/pulse-sdk'
 *   
 *   Pulse.init({
 *     endpoint: 'https://pulse.kaasino.com/collect',
 *     siteId: 'kaasino-prod'
 *   })
 */

export interface PulseConfig {
  endpoint: string
  siteId: string
  /** Batch size before flush (default: 10) */
  batchSize?: number
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Sample rate 0-1 (default: 1) */
  sampleRate?: number
  /** Custom headers for requests */
  headers?: Record<string, string>
  /** Player ID resolver */
  getPlayerId?: () => string | null
}

interface MetricEvent {
  time: string
  session_id: string
  player_id: string | null
  device_type: string
  browser: string
  country: string | null
  event_type: string
  page_path: string
  // Web Vitals
  lcp_ms?: number
  fid_ms?: number
  cls?: number
  ttfb_ms?: number
  fcp_ms?: number
  inp_ms?: number
  // Custom
  metric_name?: string
  metric_value?: number
  metadata?: Record<string, unknown>
}

type EventType = 'page_load' | 'web_vital' | 'interaction' | 'error' | 'custom'

// ============================================
// UTILS
// ============================================

const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const getDeviceType = (): string => {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

const getBrowser = (): string => {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('SamsungBrowser')) return 'Samsung'
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
  if (ua.includes('Edge')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return 'Unknown'
}

const getSessionId = (): string => {
  const key = '_pulse_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = generateId()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

// ============================================
// WEB VITALS OBSERVER
// ============================================

interface PerformanceEntryHandler {
  (entry: PerformanceEntry): void
}

const observe = (type: string, callback: PerformanceEntryHandler): PerformanceObserver | undefined => {
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(callback)
    })
    observer.observe({ type, buffered: true } as PerformanceObserverInit)
    return observer
  } catch {
    return undefined
  }
}

// ============================================
// MAIN SDK CLASS
// ============================================

class PulseSDK {
  private config: Required<PulseConfig> | null = null
  private queue: MetricEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private sessionId: string = ''
  private observers: PerformanceObserver[] = []
  private clsValue = 0
  private clsEntries: PerformanceEntry[] = []

  init(config: PulseConfig): void {
    if (typeof window === 'undefined') return

    this.config = {
      endpoint: config.endpoint,
      siteId: config.siteId,
      batchSize: config.batchSize ?? 10,
      flushInterval: config.flushInterval ?? 5000,
      debug: config.debug ?? false,
      sampleRate: config.sampleRate ?? 1,
      headers: config.headers ?? {},
      getPlayerId: config.getPlayerId ?? (() => null),
    }

    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      this.log('Sampling: session excluded')
      return
    }

    this.sessionId = getSessionId()
    this.startFlushTimer()
    this.observeWebVitals()
    this.observeErrors()
    this.trackPageLoad()
    this.setupUnloadFlush()

    this.log('Initialized', { sessionId: this.sessionId })
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Track custom metric
   */
  track(name: string, value: number, metadata?: Record<string, unknown>): void {
    this.push('custom', {
      metric_name: name,
      metric_value: value,
      metadata,
    })
  }

  /**
   * Track user interaction
   */
  interaction(name: string, metadata?: Record<string, unknown>): void {
    this.push('interaction', {
      metric_name: name,
      metadata,
    })
  }

  /**
   * Track error
   */
  error(error: Error | string, metadata?: Record<string, unknown>): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    this.push('error', {
      metric_name: errorObj.name,
      metadata: {
        message: errorObj.message,
        stack: errorObj.stack?.slice(0, 1000),
        ...metadata,
      },
    })
  }

  /**
   * Manual flush
   */
  flush(): Promise<void> {
    return this.sendBatch()
  }

  /**
   * Set player ID dynamically (after login)
   */
  setPlayerId(resolver: () => string | null): void {
    if (this.config) {
      this.config.getPlayerId = resolver
    }
  }

  /**
   * Destroy SDK
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.observers.forEach((o) => o.disconnect())
    this.flush()
  }

  // ============================================
  // INTERNAL
  // ============================================

  private push(eventType: EventType, data: Partial<MetricEvent>): void {
    if (!this.config) return

    const event: MetricEvent = {
      time: new Date().toISOString(),
      session_id: this.sessionId,
      player_id: this.config.getPlayerId(),
      device_type: getDeviceType(),
      browser: getBrowser(),
      country: null, // Resolved server-side via IP
      event_type: eventType,
      page_path: window.location.pathname,
      ...data,
    }

    this.queue.push(event)
    this.log('Event queued', event)

    if (this.queue.length >= this.config.batchSize) {
      this.sendBatch()
    }
  }

  private async sendBatch(): Promise<void> {
    if (!this.config || this.queue.length === 0) return

    const batch = this.queue.splice(0, this.config.batchSize)

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Site-Id': this.config.siteId,
          ...this.config.headers,
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      })

      if (!response.ok) {
        // Re-queue on failure
        this.queue.unshift(...batch)
        this.log('Send failed, re-queued', { status: response.status })
      } else {
        this.log('Batch sent', { count: batch.length })
      }
    } catch (err) {
      this.queue.unshift(...batch)
      this.log('Send error, re-queued', err)
    }
  }

  private startFlushTimer(): void {
    if (!this.config) return
    this.flushTimer = setInterval(() => {
      this.sendBatch()
    }, this.config.flushInterval)
  }

  private setupUnloadFlush(): void {
    // Flush on page hide (works on mobile too)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Report final CLS
        this.reportCLS()
        this.sendBatch()
      }
    })

    // Fallback for older browsers
    window.addEventListener('pagehide', () => {
      this.reportCLS()
      this.sendBatch()
    })
  }

  // ============================================
  // WEB VITALS
  // ============================================

  private observeWebVitals(): void {
    // LCP
    const lcpObserver = observe('largest-contentful-paint', (entry) => {
      this.push('web_vital', {
        lcp_ms: Math.round(entry.startTime),
        metric_name: 'LCP',
      })
    })
    if (lcpObserver) this.observers.push(lcpObserver)

    // FID
    const fidObserver = observe('first-input', (entry) => {
      const fidEntry = entry as PerformanceEventTiming
      this.push('web_vital', {
        fid_ms: Math.round(fidEntry.processingStart - fidEntry.startTime),
        metric_name: 'FID',
      })
    })
    if (fidObserver) this.observers.push(fidObserver)

    // CLS (accumulated)
    const clsObserver = observe('layout-shift', (entry) => {
      const lsEntry = entry as LayoutShift
      if (!lsEntry.hadRecentInput) {
        this.clsValue += lsEntry.value
        this.clsEntries.push(entry)
      }
    })
    if (clsObserver) this.observers.push(clsObserver)

    // INP (Interaction to Next Paint)
    const inpObserver = observe('event', (entry) => {
      const eventEntry = entry as PerformanceEventTiming
      if (eventEntry.interactionId) {
        const duration = eventEntry.duration
        this.push('web_vital', {
          inp_ms: Math.round(duration),
          metric_name: 'INP',
          metadata: { eventType: eventEntry.name },
        })
      }
    })
    if (inpObserver) this.observers.push(inpObserver)

    // TTFB & FCP from navigation/paint timing
    this.observeNavigationTiming()
  }

  private observeNavigationTiming(): void {
    // Wait for load
    if (document.readyState === 'complete') {
      this.reportNavigationTiming()
    } else {
      window.addEventListener('load', () => {
        // Small delay to ensure metrics are available
        setTimeout(() => this.reportNavigationTiming(), 0)
      })
    }
  }

  private reportNavigationTiming(): void {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (!nav) return

    // TTFB
    const ttfb = nav.responseStart - nav.requestStart
    this.push('web_vital', {
      ttfb_ms: Math.round(ttfb),
      metric_name: 'TTFB',
    })

    // FCP
    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint')
    if (fcpEntry) {
      this.push('web_vital', {
        fcp_ms: Math.round(fcpEntry.startTime),
        metric_name: 'FCP',
      })
    }
  }

  private reportCLS(): void {
    if (this.clsValue > 0) {
      this.push('web_vital', {
        cls: Math.round(this.clsValue * 1000) / 1000,
        metric_name: 'CLS',
      })
    }
  }

  // ============================================
  // PAGE LOAD
  // ============================================

  private trackPageLoad(): void {
    if (document.readyState === 'complete') {
      this.reportPageLoad()
    } else {
      window.addEventListener('load', () => this.reportPageLoad())
    }
  }

  private reportPageLoad(): void {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (!nav) return

    this.push('page_load', {
      metadata: {
        dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcp: Math.round(nav.connectEnd - nav.connectStart),
        request: Math.round(nav.responseStart - nav.requestStart),
        response: Math.round(nav.responseEnd - nav.responseStart),
        dom: Math.round(nav.domContentLoadedEventEnd - nav.responseEnd),
        load: Math.round(nav.loadEventEnd - nav.loadEventStart),
        total: Math.round(nav.loadEventEnd - nav.startTime),
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
      },
    })
  }

  // ============================================
  // ERROR TRACKING
  // ============================================

  private observeErrors(): void {
    // JS errors
    window.addEventListener('error', (event) => {
      this.push('error', {
        metric_name: 'js_error',
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.push('error', {
        metric_name: 'promise_rejection',
        metadata: {
          reason: String(event.reason),
        },
      })
    })
  }

  // ============================================
  // DEBUG
  // ============================================

  private log(...args: unknown[]): void {
    if (this.config?.debug) {
      console.log('[Pulse]', ...args)
    }
  }
}

// Type declarations for Web Vitals entries
interface LayoutShift extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number
  interactionId?: number
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const Pulse = new PulseSDK()

// Also export class for multiple instances
export { PulseSDK }

// Default export
export default Pulse
