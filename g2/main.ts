import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import { toggleMenu, setMenuItem, state, type MenuItem } from './state'
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

          // Handle clicks on the hamburger area (any of the bar containers)
          if (event.sysEvent && (event.sysEvent.eventType ?? 0) === OsEventTypeList.CLICK_EVENT) {
            handleMenuInteraction()
          }
        })

        await initApp(bridge)
        connected = true
        setStatus('Connected. Tap hamburger at (0,0) on glasses.')
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
  if (!state.menuOpen) {
    // Menu is closed, open it
    toggleMenu()
    await updateMenuDisplay()
  } else {
    // Menu is open, cycle to next menu item
    const menuItems: MenuItem[] = ['home', 'settings', 'about', 'help']
    const currentIndex = menuItems.indexOf(state.currentMenuItem)
    const nextIndex = (currentIndex + 1) % menuItems.length
    setMenuItem(menuItems[nextIndex])
    await updateMenuDisplay()
  }
}
