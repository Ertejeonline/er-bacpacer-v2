import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import {
  clearDrinkEntries,
  getBacEstimateAt,
  getBacSettings,
  formatDrinkEntryTime,
  removeDrinkEntry,
  setBacSettings,
  setMenuItem,
  setFocusedMenuItem,
  setAddDrinkSubmenuVisible,
  setDrinkMl,
  setDrinkPercent,
  state,
  storeCurrentDrink,
  updateDrinkEntry,
} from './state'
import {
  addDrinkSubmenuItemFromIndex,
  menuItemFromIndex,
  resetRendererSession,
  updateMenuDisplay,
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
  let connecting = false
  let appInForeground = true
  let exitDialogPending = false
  let exitDialogRecoveryTimerId: number | null = null
  let unsubscribeEvenHubEvent: (() => void) | null = null
  let refreshTimerId: number | null = null
  let teardownRegistered = false

  const stopRefreshTimer = () => {
    if (refreshTimerId !== null) {
      window.clearTimeout(refreshTimerId)
      refreshTimerId = null
    }
  }

  const clearExitDialogRecoveryTimer = () => {
    if (exitDialogRecoveryTimerId !== null) {
      window.clearTimeout(exitDialogRecoveryTimerId)
      exitDialogRecoveryTimerId = null
    }
  }

  const startRefreshTimer = () => {
    if (!connected) return
    stopRefreshTimer()

    const tick = () => {
      if (!connected || !appInForeground) return
      void updateMenuDisplay()
    }

    const scheduleIn = (delayMs: number) => {
      refreshTimerId = window.setTimeout(() => {
        refreshTimerId = null
        tick()
        scheduleIn(60_000)
      }, delayMs)
    }

    // Refresh immediately, then align to the next wall-clock minute.
    tick()
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    scheduleIn(msToNextMinute)
  }

  const refreshDisplayIfActive = () => {
    if (!connected || !appInForeground) return
    void updateMenuDisplay()
  }

  const logMenuContext = (stage: string, extra?: string) => {
    const suffix = extra ? ` ${extra}` : ''
    appendEventLog(
      `MenuFlow: ${stage} menuVisible=${String(state.menuVisible)} addSub=${String(state.addDrinkSubmenuVisible)} current=${state.currentMenuItem}${suffix}`,
    )
  }

  const inferForegroundFromInput = () => {
    if (!connected || appInForeground) return
    appInForeground = true
    appendEventLog('Lifecycle: inferred foreground from input')
    startRefreshTimer()
  }

  const scheduleExitDialogRecovery = () => {
    clearExitDialogRecoveryTimer()
    exitDialogRecoveryTimerId = window.setTimeout(() => {
      exitDialogRecoveryTimerId = null
      if (!connected || !exitDialogPending) return

      // Some firmware sequences send enter/exit around the system dialog in
      // different order. If no hard-exit event arrived, recover to active state.
      exitDialogPending = false
      appInForeground = true
      appendEventLog('Lifecycle: exit dialog transition settled (recover active)')
      startRefreshTimer()
      refreshDisplayIfActive()
    }, 2000)
  }

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

    stopRefreshTimer()
    clearExitDialogRecoveryTimer()
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
      if (connecting) {
        setStatus('Connection already in progress...')
        return
      }
      if (connected) {
        setStatus('Already connected')
        return
      }

      connecting = true

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
            inferForegroundFromInput()
            if (exitDialogPending) {
              appendEventLog('Lifecycle: exit dialog dismissed by user input')
              exitDialogPending = false
              clearExitDialogRecoveryTimer()
            }
            if (!state.menuVisible) return
            const eventType = event.listEvent.eventType ?? 0
            if (eventType === OsEventTypeList.CLICK_EVENT) {
              const index = event.listEvent.currentSelectItemIndex ?? 0
              const itemName = event.listEvent.currentSelectItemName ?? ''
              logMenuContext('list-click', `idx=${index} name="${itemName}"`)

              if (state.addDrinkSubmenuVisible) {
                const submenuItem = addDrinkSubmenuItemFromIndex(index)
                if (submenuItem) {
                  appendEventLog(`MenuFlow: add-submenu-click item="${submenuItem}" idx=${index}`)
                  if (submenuItem === 'Add drink') {
                    const entry = storeCurrentDrink()
                    appendEventLog(`Drink stored: ${entry.ml} ml @ ${entry.percent}% (${formatDrinkEntryTime(entry.timestampMs)})`)
                    // After confirming a drink, open Home directly.
                    setAddDrinkSubmenuVisible(false)
                    setMenuItem('home')
                    logMenuContext('open-home-after-add-drink')
                    refreshDisplayIfActive()
                    return
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
                  refreshDisplayIfActive()
                }
              } else {
                const selected = menuItemFromIndex(index)
                appendEventLog(`MenuFlow: main-select resolved=${selected ?? 'undefined'} idx=${index} name="${itemName}"`)
                if (selected === 'adddrink') {
                  logMenuContext('open-add-submenu-before')
                  setAddDrinkSubmenuVisible(true)
                  logMenuContext('open-add-submenu-after')
                  refreshDisplayIfActive()
                  return
                }
                if (selected) {
                  logMenuContext('open-detail-before', `selected=${selected}`)
                  setMenuItem(selected)
                  logMenuContext('open-detail-after', `selected=${selected}`)
                  refreshDisplayIfActive()
                }
              }
            }
            return
          }

          if (event.sysEvent) {
            const eventType = event.sysEvent.eventType ?? 0
            if (eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
              appendEventLog('Lifecycle: foreground enter')
              if (exitDialogPending) {
                appendEventLog('Lifecycle: exit dialog transition (enter)')
                scheduleExitDialogRecovery()
                return
              }

              appInForeground = true
              startRefreshTimer()
              refreshDisplayIfActive()
              return
            }
            if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
              appendEventLog('Lifecycle: foreground exit')
              if (exitDialogPending) {
                appendEventLog('Lifecycle: exit dialog transition (exit)')
                scheduleExitDialogRecovery()
                return
              }
              appInForeground = false
              stopRefreshTimer()
              return
            }
            if (eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT || eventType === OsEventTypeList.SYSTEM_EXIT_EVENT) {
              appendEventLog(`Lifecycle: exit event=${String(eventType)}`)
              appInForeground = false
              exitDialogPending = false
              clearExitDialogRecoveryTimer()
              cleanupBridgeListeners()
              resetRendererSession()
              connected = false
              setStatus('Disconnected. Tap Connect to reconnect.')
              return
            }

            // Some firmware paths can miss FOREGROUND_ENTER after overlay dismissal.
            inferForegroundFromInput()

            if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
              const atRootMenu = state.menuVisible && !state.addDrinkSubmenuVisible
              if (atRootMenu) {
                exitDialogPending = true
                scheduleExitDialogRecovery()
                appendEventLog('Menu double-tap: shutDownPageContainer(1)')
                void bridge.shutDownPageContainer(1)
                return
              }
              exitDialogPending = false
              clearExitDialogRecoveryTimer()
              showMenu()
            }
          }
        })

        await initApp(bridge)
        connected = true
          appInForeground = true
          exitDialogPending = false
        clearExitDialogRecoveryTimer()
        startRefreshTimer()
        setStatus('Connected. Swipe to focus, click to open, double-click to go back.')
        appendEventLog('Bridge connected - list menu ready')
      } catch (err) {
        console.error('[bacpacer] connect failed', err)
        setStatus('Bridge not found. Running in mock mode.')
        appendEventLog('Connection failed')
      } finally {
        connecting = false
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

    reset: async () => {
      if (!connected) {
        setStatus('Not connected')
        return
      }

      clearDrinkEntries()
      await updateMenuDisplay()
      void updateTopRightCountdownOnly()
      setStatus('Drink history reset')
      appendEventLog('Drink history reset from phone UI')
    },

    getDrinkEntries: () => [...state.drinkEntries],

    getBacSettings: () => getBacSettings(),

    updateBacSettings: (next) => {
      setBacSettings(next)
      refreshDisplayIfActive()
    },

    getBacEstimate: () => getBacEstimateAt(),

    removeDrinkEntry: (timestampMs: number) => {
      const removed = removeDrinkEntry(timestampMs)
      if (!removed) return

      setStatus('Drink removed from log')
      appendEventLog(`Drink removed from phone UI: timestamp=${timestampMs}`)
    },

    updateDrinkEntry: (originalTimestampMs, nextEntry) => {
      const updated = updateDrinkEntry(originalTimestampMs, nextEntry)
      if (!updated) return false

      setStatus('Drink updated')
      appendEventLog(`Drink updated from phone UI: from=${originalTimestampMs} to=${nextEntry.timestampMs} ml=${nextEntry.ml} abv=${nextEntry.percent}`)
      return true
    },
  }
}

async function showMenu(): Promise<void> {
  state.menuVisible = true
  setAddDrinkSubmenuVisible(false)
  setFocusedMenuItem(state.currentMenuItem)
  await updateMenuDisplay()
}
