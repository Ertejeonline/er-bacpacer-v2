// Application state management
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type MenuItem = 'home' | 'adddrink' | 'setupdrink' | 'help'

const PERSISTENCE_KEY = 'bacpacer.persisted.v1'

type PersistedState = {
  bpm: number
  pacerRunning: boolean
  drinkMl: number
  drinkPercent: number
}

const DEFAULT_PERSISTED_STATE: PersistedState = {
  bpm: 120,
  pacerRunning: false,
  drinkMl: 175,
  drinkPercent: 13.5,
}

export const state = {
  startupRendered: false,
  menuVisible: true, // new state to control menu visibility
  addDrinkSubmenuVisible: false,
  currentMenuItem: 'home' as MenuItem,
  focusedMenuItem: 'home' as MenuItem,
  pacerRunning: DEFAULT_PERSISTED_STATE.pacerRunning,
  bpm: DEFAULT_PERSISTED_STATE.bpm,
  drinkMl: DEFAULT_PERSISTED_STATE.drinkMl,
  drinkPercent: DEFAULT_PERSISTED_STATE.drinkPercent,
}

let _bridge: EvenAppBridge | null = null

export function getBridge(): EvenAppBridge | null {
  return _bridge
}

export function setBridge(b: EvenAppBridge): void {
  _bridge = b
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toPersistedState(): PersistedState {
  return {
    bpm: clampNumber(state.bpm, 60, 200),
    pacerRunning: Boolean(state.pacerRunning),
    drinkMl: clampNumber(state.drinkMl, 0, 2000),
    drinkPercent: clampNumber(state.drinkPercent, 0, 100),
  }
}

export function savePersistedState(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(toPersistedState()))
  } catch (err) {
    console.warn('[bacpacer] failed to save persisted state', err)
  }
}

export function loadPersistedState(): void {
  if (!canUseStorage()) return
  try {
    const raw = window.localStorage.getItem(PERSISTENCE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as Partial<PersistedState>

    if (typeof parsed.bpm === 'number') {
      state.bpm = clampNumber(parsed.bpm, 60, 200)
    }
    if (typeof parsed.pacerRunning === 'boolean') {
      state.pacerRunning = parsed.pacerRunning
    }
    if (typeof parsed.drinkMl === 'number') {
      state.drinkMl = clampNumber(parsed.drinkMl, 0, 2000)
    }
    if (typeof parsed.drinkPercent === 'number') {
      state.drinkPercent = clampNumber(parsed.drinkPercent, 0, 100)
    }
  } catch (err) {
    console.warn('[bacpacer] failed to load persisted state', err)
  }
}

export function setMenuItem(item: MenuItem): void {
  state.currentMenuItem = item
  // Selecting an item opens its content view and hides the menu.
  state.menuVisible = false
}

export function setFocusedMenuItem(item: MenuItem): void {
  state.focusedMenuItem = item
}

export function setAddDrinkSubmenuVisible(visible: boolean): void {
  state.addDrinkSubmenuVisible = visible
}

export function setBpm(value: number): void {
  state.bpm = clampNumber(value, 60, 200)
  savePersistedState()
}

export function setPacerRunning(running: boolean): void {
  state.pacerRunning = running
  savePersistedState()
}

export function setDrinkMl(value: number): void {
  state.drinkMl = clampNumber(value, 0, 2000)
  savePersistedState()
}

export function setDrinkPercent(value: number): void {
  state.drinkPercent = clampNumber(value, 0, 100)
  savePersistedState()
}
