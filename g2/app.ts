import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { onEvenHubEvent } from './events'
import { showMenu, showSession, upgradeSessionText } from './renderer'
import { getBridge, setBridge, state } from './state'

let unsubscribe: (() => void) | null = null

function stopTicker(): void {
  if (state.intervalId !== 0) {
    window.clearInterval(state.intervalId)
    state.intervalId = 0
  }
}

function startTicker(): void {
  stopTicker()

  state.intervalId = window.setInterval(() => {
    if (!state.running) return

    if (state.sessionSeconds <= 0) {
      state.running = false
      stopTicker()
      void upgradeSessionText()
      appendEventLog('Session complete')
      return
    }

    state.sessionSeconds -= 1
    void upgradeSessionText()
  }, 1000)
}

export async function resetAndStartSession(): Promise<void> {
  state.sessionSeconds = 5 * 60
  state.running = true
  await showSession()
  startTicker()
}

export async function toggleSession(): Promise<void> {
  state.running = !state.running
  appendEventLog(state.running ? 'Session resumed' : 'Session paused')
  await upgradeSessionText()
}

export async function adjustSession(deltaSeconds: number): Promise<void> {
  state.sessionSeconds = Math.max(0, Math.min(99 * 60, state.sessionSeconds + deltaSeconds))
  await upgradeSessionText()
}

export async function cleanupApp(): Promise<void> {
  stopTicker()
  state.running = false

  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }

  const bridge = getBridge()
  if (bridge) {
    try {
      await bridge.audioControl(false)
    } catch {
      appendEventLog('audioControl(false) skipped')
    }

    try {
      await bridge.imuControl(false)
    } catch {
      appendEventLog('imuControl(false) skipped')
    }
  }

  appendEventLog('Cleanup complete')
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)

  unsubscribe = appBridge.onEvenHubEvent((event: EvenHubEvent) => {
    void onEvenHubEvent(event)
  })

  window.addEventListener('beforeunload', () => {
    void cleanupApp()
  })

  await showMenu()
  appendEventLog('App initialized')
}
