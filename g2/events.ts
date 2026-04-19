// Event handling for device interactions
import { state, setMenuItem, type MenuItem } from './state'
import { updateMenuDisplay, showContent } from './renderer'

export async function handleMenuSelect(item: MenuItem): Promise<void> {
  setMenuItem(item)
  await updateMenuDisplay()
  await showContent()
}

export async function handlePacerToggle(): Promise<void> {
  state.pacerRunning = !state.pacerRunning
  await showContent()
}

export async function handleBpmChange(delta: number): Promise<void> {
  state.bpm = Math.max(60, Math.min(200, state.bpm + delta))
  await showContent()
}
