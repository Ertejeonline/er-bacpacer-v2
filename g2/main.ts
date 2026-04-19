import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import {
  clearDrinkEntries,
  setMenuItem,
  setFocusedMenuItem,
  setAddDrinkSubmenuVisible,
  setDrinkMl,
  setDrinkPercent,
  setResetConfirmChoice,
  setResetConfirmVisible,
  state,
  storeCurrentDrink,
} from './state'
import {
  addDrinkSubmenuItemFromIndex,
  menuItemFromIndex,
  resetConfirmChoiceFromIndex,
  updateMenuDisplay,
  updateRightDynamicContentOnly,
  updateTopRightCountdownOnly,
} from './renderer'

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
  let refreshTimerId: number | null = null
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

    if (refreshTimerId !== null) {
      window.clearInterval(refreshTimerId)
      refreshTimerId = null
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

        refreshTimerId = window.setInterval(() => {
          void updateTopRightCountdownOnly()
        }, 60_000)

        // Use native list menu events for robust selection and highlight.
        unsubscribeEvenHubEvent = bridge.onEvenHubEvent((event) => {
          console.log('EvenHub event:', event)

          if (event.listEvent) {
            if (!state.menuVisible) return
            const eventType = event.listEvent.eventType ?? 0
            if (eventType === OsEventTypeList.CLICK_EVENT) {
              const index = event.listEvent.currentSelectItemIndex ?? 0
              if (state.resetConfirmVisible) {
                const choice = resetConfirmChoiceFromIndex(index)
                if (!choice) return

                setResetConfirmChoice(choice)
                if (choice === 'yes') {
                  clearDrinkEntries()
                  appendEventLog('Drink history reset')
                }

                setResetConfirmVisible(false)
                setAddDrinkSubmenuVisible(false)
                void updateMenuDisplay()
                return
              }

              if (state.addDrinkSubmenuVisible) {
                const submenuItem = addDrinkSubmenuItemFromIndex(index)
                if (submenuItem) {
                  if (submenuItem === 'Add drink') {
                    const entry = storeCurrentDrink()
                    appendEventLog(`Drink stored: ${entry.ml} ml @ ${entry.percent}% (${entry.timeHHMM})`)
                  } else if (submenuItem === '+ ml') {
                    setDrinkMl(state.drinkMl + 25)
                  } else if (submenuItem === '- ml') {
                    setDrinkMl(state.drinkMl - 25)
                  } else if (submenuItem === '+ %') {
                    setDrinkPercent(state.drinkPercent + 0.5)
                  } else if (submenuItem === '- %') {
                    setDrinkPercent(state.drinkPercent - 0.5)
                  }
                  appendEventLog(`Add drink submenu: ${submenuItem} (ml=${state.drinkMl}, abv=${state.drinkPercent}%)`)
                  void updateRightDynamicContentOnly()
                }
              } else {
                const selected = menuItemFromIndex(index)
                if (selected === 'adddrink') {
                  setResetConfirmVisible(false)
                  setAddDrinkSubmenuVisible(true)
                  void updateMenuDisplay()
                  return
                }
                if (selected === 'reset') {
                  setAddDrinkSubmenuVisible(false)
                  setResetConfirmChoice('no')
                  setResetConfirmVisible(true)
                  void updateMenuDisplay()
                  return
                }
                if (selected) {
                  setResetConfirmVisible(false)
                  setMenuItem(selected)
                  void updateMenuDisplay()
                }
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
  setAddDrinkSubmenuVisible(false)
  setResetConfirmVisible(false)
  setResetConfirmChoice('no')
  setFocusedMenuItem(state.currentMenuItem)
  await updateMenuDisplay()
}
