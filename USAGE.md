# Kaasino Pulse SDK - Usage Examples

## Basic Setup

```typescript
// main.ts or entry point
import { Pulse } from '@kaasino/pulse-sdk'

Pulse.init({
  endpoint: 'https://pulse.kaasino.com/collect',
  siteId: 'kaasino-prod',
  debug: process.env.NODE_ENV === 'development',
  
  // Optional: resolve player ID from your auth state
  getPlayerId: () => window.__KAASINO__?.playerId ?? null,
})
```

## React Setup

```tsx
// App.tsx
import { PulseProvider } from '@kaasino/pulse-sdk/react'
import { useAuth } from './hooks/useAuth'

function App() {
  const { playerId } = useAuth()

  return (
    <PulseProvider 
      config={{
        endpoint: import.meta.env.VITE_PULSE_ENDPOINT,
        siteId: 'kaasino-prod',
        getPlayerId: () => playerId,
      }}
    >
      <Router />
    </PulseProvider>
  )
}
```

## Tracking Custom Events

```typescript
import { Pulse } from '@kaasino/pulse-sdk'

// Track deposit flow timing
const startDeposit = performance.now()

await processDeposit(amount)

Pulse.track('deposit_flow', performance.now() - startDeposit, {
  psp: 'pix',
  amount,
  currency: 'BRL',
})
```

## Tracking Interactions

```typescript
// Button clicks
Pulse.interaction('deposit_button_click', { 
  location: 'header',
  amount_prefilled: true,
})

// Game launches
Pulse.interaction('game_launch', {
  provider: 'pragmatic',
  game_id: 'sweet-bonanza',
  game_type: 'slot',
})

// Bonus claims
Pulse.interaction('bonus_claim', {
  bonus_type: 'welcome',
  bonus_id: 'WB-001',
})
```

## Error Tracking

```typescript
try {
  await launchGame(gameId)
} catch (err) {
  Pulse.error(err as Error, {
    context: 'game_launch',
    game_id: gameId,
    provider: 'softswiss',
  })
  throw err
}
```

## React Hooks

```tsx
import { usePulse, useTrackClick, useRenderTime } from '@kaasino/pulse-sdk/react'

function DepositModal() {
  // Auto-track render time
  useRenderTime('DepositModal')
  
  const { track, interaction } = usePulse()
  
  // Track button clicks
  const handleDepositClick = useTrackClick('deposit_submit', {
    modal: 'deposit',
  })

  const handleSubmit = async (amount: number) => {
    const start = performance.now()
    
    try {
      await submitDeposit(amount)
      track('deposit_success', performance.now() - start, { amount })
    } catch (err) {
      track('deposit_error', performance.now() - start, { amount })
      throw err
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button onClick={handleDepositClick}>Deposit</button>
    </form>
  )
}
```

## Track Async Operations

```tsx
import { useTrackAsync } from '@kaasino/pulse-sdk/react'

function GameLobby() {
  const [games, setGames] = useState([])
  
  // Automatically tracks duration + success/failure
  const fetchGames = useTrackAsync(
    'games_fetch',
    async () => {
      const response = await api.get('/games')
      return response.data
    },
    []
  )

  useEffect(() => {
    fetchGames().then(setGames)
  }, [])
}
```

## Error Boundary

```tsx
import { PulseErrorBoundary } from '@kaasino/pulse-sdk/react'

function App() {
  return (
    <PulseErrorBoundary fallback={<ErrorPage />}>
      <GameLobby />
    </PulseErrorBoundary>
  )
}
```

## Game Provider Integration

```typescript
// Track game load from provider iframe
window.addEventListener('message', (event) => {
  if (event.data.type === 'GAME_LOADED') {
    Pulse.track('game_load_complete', event.data.loadTime, {
      provider: event.data.provider,
      game_id: event.data.gameId,
    })
  }
  
  if (event.data.type === 'GAME_ERROR') {
    Pulse.error(event.data.error, {
      provider: event.data.provider,
      game_id: event.data.gameId,
    })
  }
})
```

## PSP Integration

```typescript
// Wrap PSP SDK calls
class DepositService {
  async processDeposit(psp: string, amount: number) {
    const start = performance.now()
    
    try {
      const result = await this.pspClient.deposit(amount)
      
      Pulse.track('psp_deposit', performance.now() - start, {
        psp,
        amount,
        success: true,
        transaction_id: result.id,
      })
      
      return result
    } catch (err) {
      Pulse.track('psp_deposit', performance.now() - start, {
        psp,
        amount,
        success: false,
        error_code: (err as any).code,
      })
      
      Pulse.error(err as Error, { psp, operation: 'deposit' })
      throw err
    }
  }
}
```

## WebSocket Connection Quality

```typescript
class GameSocket {
  private pulse = Pulse
  private lastPing = 0
  
  connect(gameId: string) {
    this.ws = new WebSocket(url)
    
    this.ws.onopen = () => {
      this.pulse.interaction('ws_connect', { game_id: gameId })
    }
    
    this.ws.onclose = (event) => {
      this.pulse.interaction('ws_disconnect', {
        game_id: gameId,
        code: event.code,
        reason: event.reason,
        clean: event.wasClean,
      })
    }
    
    this.ws.onerror = () => {
      this.pulse.error('WebSocket error', { game_id: gameId })
    }
    
    // Track latency via ping/pong
    setInterval(() => {
      this.lastPing = performance.now()
      this.ws.send(JSON.stringify({ type: 'ping' }))
    }, 10000)
  }
  
  onMessage(data: any) {
    if (data.type === 'pong') {
      const latency = performance.now() - this.lastPing
      this.pulse.track('ws_latency', latency)
    }
  }
}
```

## Sampling for High-Traffic

```typescript
// Production: sample 10% of sessions
Pulse.init({
  endpoint: 'https://pulse.kaasino.com/collect',
  siteId: 'kaasino-prod',
  sampleRate: 0.1, // 10%
})

// Staging: capture everything
Pulse.init({
  endpoint: 'https://pulse-staging.kaasino.com/collect',
  siteId: 'kaasino-staging',
  sampleRate: 1.0, // 100%
  debug: true,
})
```

## Dynamic Player ID (Post-Login)

```typescript
// After successful login
Pulse.setPlayerId(() => authStore.getPlayerId())

// Or with React context
const { playerId } = useAuth()

useEffect(() => {
  Pulse.setPlayerId(() => playerId)
}, [playerId])
```
