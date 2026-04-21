import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, toggleSession } from './app'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Timeout after ${String(timeoutMs)}ms`))
    }, timeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer))
  })
}

export function createAppActions(setStatus: SetStatus): AppActions {
  let connected = false

  return {
    async connect(): Promise<void> {
      setStatus('Connecting to Even app bridge...')
      appendEventLog(`ER Bacpacer v${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`)

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('Connected. Use your glasses touch controls.')
      } catch (error) {
        console.error('[g2] connect failed', error)
        setStatus('Bridge not found. Open in Even Hub app or simulator.')
        appendEventLog('Bridge connection failed')
      }
    },

    async action(): Promise<void> {
      if (!connected) {
        setStatus('Not connected')
        return
      }

      await toggleSession()
      setStatus('Toggled session state')
    },
  }
}
