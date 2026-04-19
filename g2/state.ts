// Application state management
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type MenuItem = 'home' | 'settings' | 'about' | 'help'

export const state = {
  startupRendered: false,
  menuVisible: true, // new state to control menu visibility
  currentMenuItem: 'home' as MenuItem,
  focusedMenuItem: 'home' as MenuItem,
  pacerRunning: false,
  bpm: 120,
}

let _bridge: EvenAppBridge | null = null

export function getBridge(): EvenAppBridge | null {
  return _bridge
}

export function setBridge(b: EvenAppBridge): void {
  _bridge = b
}

export function setMenuItem(item: MenuItem): void {
  state.currentMenuItem = item
  // Selecting an item opens its content view and hides the menu.
  state.menuVisible = false
}

export function setFocusedMenuItem(item: MenuItem): void {
  state.focusedMenuItem = item
}
