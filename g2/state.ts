// Application state management
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type MenuItem = 'home' | 'settings' | 'about' | 'help'

export const state = {
  startupRendered: false,
  menuOpen: false,
  currentMenuItem: 'home' as MenuItem,
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

export function toggleMenu(): void {
  state.menuOpen = !state.menuOpen
}

export function setMenuItem(item: MenuItem): void {
  state.currentMenuItem = item
  state.menuOpen = false // Close menu when selecting item
}
