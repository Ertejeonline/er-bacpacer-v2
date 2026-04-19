import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import { setMenuItem, setFocusedMenuItem, state, type MenuItem } from './state'
import { updateMenuDisplay } from './renderer'

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

  return {
    connect: async () => {
      setStatus('Connecting to Even bridge...')
      appendEventLog(`Bacpacer v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`)

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)

        // Set up event handling for hamburger menu
        bridge.onEvenHubEvent((event) => {
          console.log('EvenHub event:', event)

          if (event.textEvent) {
            if (!state.menuVisible) return
            const eventType = event.textEvent.eventType ?? 0
            if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
              moveMenuFocus(-1)
            } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
              moveMenuFocus(1)
            }
            return
          }

          if (event.sysEvent) {
            const eventType = event.sysEvent.eventType ?? 0
            if (eventType === OsEventTypeList.CLICK_EVENT) {
              if (!state.menuVisible) return
              selectFocusedMenuItem()
            } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
              showMenu()
            }
          }
        })

        await initApp(bridge)
        connected = true
        setStatus('Connected. Swipe to focus, click to open, double-click to go back.')
        appendEventLog('Bridge connected - hamburger menu ready')
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

// Handle menu interactions based on current state
async function handleMenuInteraction(): Promise<void> {
  // Kept for backward compatibility; click selects focused item.
  await selectFocusedMenuItem()
}

async function moveMenuFocus(delta: number): Promise<void> {
  const menuItems: MenuItem[] = ['home', 'settings', 'about', 'help']
  const currentIndex = menuItems.indexOf(state.focusedMenuItem)
  const nextIndex = (currentIndex + delta + menuItems.length) % menuItems.length
  setFocusedMenuItem(menuItems[nextIndex])
  await updateMenuDisplay()
}

async function selectFocusedMenuItem(): Promise<void> {
  setMenuItem(state.focusedMenuItem)
  await updateMenuDisplay()
}

async function showMenu(): Promise<void> {
  state.menuVisible = true
  setFocusedMenuItem(state.currentMenuItem)
  await updateMenuDisplay()
}
