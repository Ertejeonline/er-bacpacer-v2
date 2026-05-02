import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../_shared/log', () => ({
  appendEventLog: vi.fn(),
}))

vi.mock('@evenrealities/even_hub_sdk', () => {
  class BaseContainer {
    constructor(config: Record<string, unknown>) {
      Object.assign(this, config)
    }
  }

  return {
    CreateStartUpPageContainer: BaseContainer,
    ListContainerProperty: BaseContainer,
    ListItemContainerProperty: BaseContainer,
    RebuildPageContainer: BaseContainer,
    TextContainerProperty: BaseContainer,
    TextContainerUpgrade: BaseContainer,
  }
})

import { setBridge, state } from '../../g2/state'
import {
  addDrinkSubmenuItemFromIndex,
  initMenu,
  menuItemFromIndex,
  resetRendererSession,
  resetStandbyHudVisibility,
  toggleStandbyHudVisibility,
  updateMenuDisplay,
  updateTopRightCountdownOnly,
} from '../../g2/renderer'

function makeBridgeMocks() {
  return {
    createStartUpPageContainer: vi.fn(async () => 0),
    rebuildPageContainer: vi.fn(async () => true),
    textContainerUpgrade: vi.fn(async () => 0),
  }
}

describe('g2/renderer', () => {
  beforeEach(() => {
    resetRendererSession()
    resetStandbyHudVisibility()

    state.menuVisible = true
    state.addDrinkSubmenuVisible = false
    state.currentMenuItem = 'standBy'
    state.focusedMenuItem = 'standBy'
    state.drinkEntries = []
  })

  it('maps main and add-drink menu indices', () => {
    expect(menuItemFromIndex(0)).toBe('standBy')
    expect(menuItemFromIndex(1)).toBe('adddrink')
    expect(menuItemFromIndex(2)).toBe('setupdrink')
    expect(menuItemFromIndex(99)).toBeUndefined()

    expect(addDrinkSubmenuItemFromIndex(0)).toBe('Add drink')
    expect(addDrinkSubmenuItemFromIndex(4)).toBe('- %')
    expect(addDrinkSubmenuItemFromIndex(99)).toBeUndefined()
  })

  it('creates page on first menu display and upgrades text containers', async () => {
    const bridge = makeBridgeMocks()
    setBridge(bridge as never)

    await updateMenuDisplay()

    expect(bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1)
    expect(bridge.rebuildPageContainer).not.toHaveBeenCalled()
    expect(bridge.textContainerUpgrade).toHaveBeenCalled()
  })

  it('rebuilds page when switching from menu to standby detail layout', async () => {
    const bridge = makeBridgeMocks()
    setBridge(bridge as never)

    await updateMenuDisplay()
    state.menuVisible = false
    state.currentMenuItem = 'standBy'
    await updateMenuDisplay()

    expect(bridge.rebuildPageContainer).toHaveBeenCalledTimes(1)
  })

  it('updates detail body text without rebuild when staying in detail layout', async () => {
    const bridge = makeBridgeMocks()
    setBridge(bridge as never)

    state.menuVisible = false
    state.currentMenuItem = 'setupdrink'
    await updateMenuDisplay()

    bridge.rebuildPageContainer.mockClear()
    bridge.textContainerUpgrade.mockClear()

    state.currentMenuItem = 'adddrink'
    state.drinkMl = 250
    state.drinkPercent = 7.5
    await updateMenuDisplay()

    expect(bridge.rebuildPageContainer).not.toHaveBeenCalled()

    const detailUpdate = bridge.textContainerUpgrade.mock.calls
      .map((args) => args[0] as { containerID?: number; content?: string })
      .find((payload) => payload.containerID === 3)

    expect(detailUpdate).toBeDefined()
    expect(detailUpdate?.content).toContain('Add drink')
    expect(detailUpdate?.content).toContain('250 ml')
  })

  it('toggles standby hud only in standby detail context', () => {
    state.menuVisible = true
    expect(toggleStandbyHudVisibility()).toBe(false)

    state.menuVisible = false
    state.currentMenuItem = 'standBy'
    expect(toggleStandbyHudVisibility()).toBe(true)
    expect(toggleStandbyHudVisibility()).toBe(false)

    state.menuVisible = true
    expect(toggleStandbyHudVisibility()).toBe(false)
  })

  it('updates top-right countdown only after containers exist', async () => {
    const bridge = makeBridgeMocks()
    setBridge(bridge as never)

    await updateTopRightCountdownOnly()
    expect(bridge.textContainerUpgrade).not.toHaveBeenCalled()

    await initMenu()
    await updateTopRightCountdownOnly()

    const topRightUpdate = bridge.textContainerUpgrade.mock.calls
      .map((args) => args[0] as { containerID?: number })
      .find((payload) => payload.containerID === 2)

    expect(topRightUpdate).toBeDefined()
  })
})
