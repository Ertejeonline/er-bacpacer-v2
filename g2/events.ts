// Event handling for device interactions
import { state, setBpm, setMenuItem, setPacerRunning, type MenuItem } from './state'
import { updateMenuDisplay, showContent } from './renderer'

export async function handleMenuSelect(item: MenuItem): Promise<void> {
  setMenuItem(item)
  await updateMenuDisplay()
  await showContent()
}

export async function handlePacerToggle(): Promise<void> {
  setPacerRunning(!state.pacerRunning)
  await showContent()
}

export async function handleBpmChange(delta: number): Promise<void> {
  setBpm(state.bpm + delta)
  await showContent()
}
