import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type Screen = 'menu' | 'session' | 'about'

export const MENU_ITEMS = ['Start 5 minute session', 'About', 'Exit']

export const state = {
  screen: 'menu' as Screen,
  startupRendered: false,
  sessionSeconds: 5 * 60,
  running: false,
  intervalId: 0,
  lastEvent: 'none',
}

let bridge: EvenAppBridge | null = null
let bridgeQueue: Promise<void> = Promise.resolve()

export function setBridge(nextBridge: EvenAppBridge): void {
  bridge = nextBridge
}

export function getBridge(): EvenAppBridge | null {
  return bridge
}

export function runBridgeTask<T>(task: () => Promise<T>): Promise<T> {
  const next = bridgeQueue.then(task, task)
  bridgeQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}
