// App state and core logic for Bacpacer
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { state, setBridge } from './state'
import { initMenu, showContent } from './renderer'

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)

  appendEventLog('Bacpacer: initialised')
  await initMenu()
  await showContent()
}

export async function updateDisplay(): Promise<void> {
  await showContent()
}
