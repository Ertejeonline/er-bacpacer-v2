import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, updateDisplay } from './app'
import {
  clearDrinkEntries,
  formatDrinkEntryTime,
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
  resetRendererSession,
  resetConfirmChoiceFromIndex,
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
  let unsubscribeEvenHubEvent: (() => void) | null = null
  let refreshTimerId: number | null = null
  let teardownRegistered = false

  const stopRefreshTimer = () => {
    if (refreshTimerId !== null) {
      window.clearInterval(refreshTimerId)
      refreshTimerId = null
    }
  }

  const startRefreshTimer = () => {
    if (!connected || !appInForeground) return
    stopRefreshTimer()
    refreshTimerId = window.setInterval(() => {
      void updateTopRightCountdownOnly()
    }, 60_000)
  }

  const refreshDisplayIfActive = () => {
    if (!connected || !appInForeground) return
    void updateMenuDisplay()
  }

  const logMenuContext = (stage: string, extra?: string) => {
    const suffix = extra ? ` ${extra}` : ''
    appendEventLog(
      `MenuFlow: ${stage} menuVisible=${String(state.menuVisible)} addSub=${String(state.addDrinkSubmenuVisible)} resetConfirm=${String(state.resetConfirmVisible)} current=${state.currentMenuItem}${suffix}`,
    )
  }

  const inferForegroundFromInput = () => {
    if (!connected || appInForeground) return
    appInForeground = true
    appendEventLog('Lifecycle: inferred foreground from input')
    startRefreshTimer()
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
            }
            if (!state.menuVisible) return
            const eventType = event.listEvent.eventType ?? 0
            if (eventType === OsEventTypeList.CLICK_EVENT) {
              const index = event.listEvent.currentSelectItemIndex ?? 0
              const itemName = event.listEvent.currentSelectItemName ?? ''
              logMenuContext('list-click', `idx=${index} name="${itemName}"`)

              if (state.resetConfirmVisible) {
                const choice = resetConfirmChoiceFromIndex(index)
                if (!choice) {
                  appendEventLog(`MenuFlow: reset-choice unresolved idx=${index} name="${itemName}"`)
                  return
                }

                appendEventLog(`MenuFlow: reset-choice=${choice} idx=${index} name="${itemName}"`)

                setResetConfirmChoice(choice)
                if (choice === 'yes') {
                  clearDrinkEntries()
                  appendEventLog('Drink history reset')
                }

                setResetConfirmVisible(false)
                setAddDrinkSubmenuVisible(false)
                logMenuContext('reset-confirm-close', `choice=${choice}`)
                refreshDisplayIfActive()
                return
              }

              if (state.addDrinkSubmenuVisible) {
                const submenuItem = addDrinkSubmenuItemFromIndex(index)
                if (submenuItem) {
                  appendEventLog(`MenuFlow: add-submenu-click item="${submenuItem}" idx=${index}`)
                  if (submenuItem === 'Add drink') {
                    const entry = storeCurrentDrink()
                    appendEventLog(`Drink stored: ${entry.ml} ml @ ${entry.percent}% (${formatDrinkEntryTime(entry.timestampMs)})`)
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
                  setResetConfirmVisible(false)
                  setAddDrinkSubmenuVisible(true)
                  logMenuContext('open-add-submenu-after')
                  refreshDisplayIfActive()
                  return
                }
                if (selected === 'reset') {
                  logMenuContext('open-reset-confirm-before')
                  setAddDrinkSubmenuVisible(false)
                  setResetConfirmChoice('no')
                  setResetConfirmVisible(true)
                  logMenuContext('open-reset-confirm-after')
                  refreshDisplayIfActive()
                  return
                }
                if (selected) {
                  logMenuContext('open-detail-before', `selected=${selected}`)
                  setResetConfirmVisible(false)
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
              appInForeground = true
              startRefreshTimer()

              if (exitDialogPending) {
                // Returning from system exit dialog can still be in transition.
                // Avoid forcing full sync until actual app interaction resumes.
                appendEventLog('Lifecycle: resume from exit dialog (defer render)')
                return
              }

              refreshDisplayIfActive()
              return
            }
            if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
              appendEventLog('Lifecycle: foreground exit')
              appInForeground = false
              stopRefreshTimer()
              return
            }
            if (eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT || eventType === OsEventTypeList.SYSTEM_EXIT_EVENT) {
              appendEventLog(`Lifecycle: exit event=${String(eventType)}`)
              appInForeground = false
              exitDialogPending = false
              cleanupBridgeListeners()
              resetRendererSession()
              connected = false
              setStatus('Disconnected. Tap Connect to reconnect.')
              return
            }

            // Some firmware paths can miss FOREGROUND_ENTER after overlay dismissal.
            inferForegroundFromInput()

            if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
              const atRootMenu = state.menuVisible && !state.addDrinkSubmenuVisible && !state.resetConfirmVisible
              if (atRootMenu) {
                exitDialogPending = true
                appendEventLog('Menu double-tap: shutDownPageContainer(1)')
                void bridge.shutDownPageContainer(1)
                return
              }
              exitDialogPending = false
              showMenu()
            }
          }
        })

        await initApp(bridge)
        connected = true
          appInForeground = true
          exitDialogPending = false
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
