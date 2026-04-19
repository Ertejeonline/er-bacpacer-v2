import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import { setMenuItem, setFocusedMenuItem, state } from './state'
import { menuItemFromIndex, updateMenuDisplay } from './renderer'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer))
  })
}

export async function createBacpacerActions(setStatus: SetStatus): Promise<AppActions> {
  let connected = false
  let unsubscribeEvenHubEvent: (() => void) | null = null
  let teardownRegistered = false

  const cleanupBridgeListeners = () => {
    if (unsubscribeEvenHubEvent) {
      try {
        unsubscribeEvenHubEvent()
        appendEventLog('EvenHub event listener cleaned up')
      } catch (err) {
        console.warn('[bacpacer] cleanup listener failed', err)
      } finally {
        unsubscribeEvenHubEvent = null
      }
    }
  }

  const registerTeardown = () => {
    if (teardownRegistered) return
    teardownRegistered = true

    const onTeardown = () => {
      cleanupBridgeListeners()
    }

    window.addEventListener('beforeunload', onTeardown)
    window.addEventListener('pagehide', onTeardown)
  }

  return {
    connect: async () => {
      setStatus('Connecting to Even bridge...')
      appendEventLog(`Bacpacer v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`)

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)

        cleanupBridgeListeners()
        registerTeardown()

        // Use native list menu events for robust selection and highlight.
        unsubscribeEvenHubEvent = bridge.onEvenHubEvent((event) => {
          console.log('EvenHub event:', event)

          if (event.listEvent) {
            if (!state.menuVisible) return
            const eventType = event.listEvent.eventType ?? 0
            if (eventType === OsEventTypeList.CLICK_EVENT) {
              const index = event.listEvent.currentSelectItemIndex ?? 0
              const selected = menuItemFromIndex(index)
              if (selected) {
                setMenuItem(selected)
                void updateMenuDisplay()
              }
            }
            return
          }

          if (event.sysEvent) {
            const eventType = event.sysEvent.eventType ?? 0
            if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
              showMenu()
            }
          }
        })

        await initApp(bridge)
        connected = true
        setStatus('Connected. Swipe to focus, click to open, double-click to go back.')
        appendEventLog('Bridge connected - list menu ready')
      } catch (err) {
        console.error('[bacpacer] connect failed', err)
        setStatus('Bridge not found. Running in mock mode.')
        appendEventLog('Connection failed')
      }
    },

    action: async () => {
      if (!connected) {
        setStatus('Not connected')
        return
      }
      await updateDisplay()
      setStatus('Display updated')
    },
  }
}

async function showMenu(): Promise<void> {
  state.menuVisible = true
  setFocusedMenuItem(state.currentMenuItem)
  await updateMenuDisplay()
}
