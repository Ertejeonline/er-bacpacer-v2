import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDrinkEntries,
  estimateDrinkDurationMs,
  formatBacGdl,
  formatDrinkEntryTime,
  getBacEstimateAt,
  getBacSettings,
  getDrinkEntryEndTimestampMs,
  loadPersistedState,
  removeDrinkEntry,
  setAddDrinkSubmenuVisible,
  setBacSettings,
  setBpm,
  setDrinkMl,
  setDrinkPercent,
  setFocusedMenuItem,
  setMenuItem,
  setPacerRunning,
  setBridge,
  state,
  storeCurrentDrink,
  updateDrinkEntry,
} from '../../g2/state'

const DEFAULT_BAC_SETTINGS = { ...state.bacSettings }

function resetState(): void {
  state.startupRendered = false
  state.menuVisible = true
  state.addDrinkSubmenuVisible = false
  state.currentMenuItem = 'standBy'
  state.focusedMenuItem = 'standBy'
  state.pacerRunning = false
  state.bpm = 120
  state.drinkMl = 175
  state.drinkPercent = 13.5
  state.drinkEntries = []
  state.bacSettings = { ...DEFAULT_BAC_SETTINGS }
  setBridge({
    getLocalStorage: async () => null,
    setLocalStorage: async () => undefined,
  } as never)
}

describe('g2/state', () => {
  beforeEach(() => {
    resetState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calculates drink duration from percent values', () => {
    expect(estimateDrinkDurationMs(100, 5)).toBe(600000)
    expect(estimateDrinkDurationMs(100, 0.05)).toBe(600000)
  })

  it('returns fallback end timestamp when endTimestampMs is missing', () => {
    const entry = {
      ml: 200,
      percent: 10,
      timestampMs: 1000,
    }

    expect(getDrinkEntryEndTimestampMs(entry)).toBe(2401000)
  })

  it('clips invalid explicit endTimestampMs to at least start timestamp', () => {
    const entry = {
      ml: 200,
      percent: 10,
      timestampMs: 5000,
      endTimestampMs: 1000,
    }

    expect(getDrinkEntryEndTimestampMs(entry)).toBe(5000)
  })

  it('stores a drink and trims prior overlapping drink end time', () => {
    const now = 1000000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    state.drinkEntries = [{
      ml: 200,
      percent: 10,
      timestampMs: now - 60000,
      endTimestampMs: now + 600000,
    }]

    setDrinkMl(300)
    setDrinkPercent(12)

    const created = storeCurrentDrink()
    expect(created.timestampMs).toBe(now)
    expect(state.drinkEntries[0]?.timestampMs).toBe(now)
    expect(state.drinkEntries[1]?.endTimestampMs).toBe(now)
  })

  it('returns zero BAC estimate with no entries', () => {
    const estimate = getBacEstimateAt(1000000)
    expect(estimate.bacGdl).toBe(0)
    expect(estimate.peakBacGdl).toBe(0)
    expect(estimate.estimatedSoberAtMs).toBeNull()
  })

  it('returns positive BAC estimate after a recent drink', () => {
    const now = 2000000
    state.drinkEntries = [{
      ml: 500,
      percent: 5,
      timestampMs: now - 10 * 60000,
      endTimestampMs: now,
    }]

    const estimate = getBacEstimateAt(now)
    expect(estimate.bacGdl).toBeGreaterThan(0)
    expect(estimate.peakBacGdl).toBeGreaterThanOrEqual(estimate.bacGdl)
  })

  it('updates, resorts, and clamps drink entry values', () => {
    state.drinkEntries = [
      { ml: 100, percent: 5, timestampMs: 1000, endTimestampMs: 2000 },
      { ml: 150, percent: 8, timestampMs: 500, endTimestampMs: 1500 },
    ]

    const updated = updateDrinkEntry(500, {
      ml: 5000,
      percent: 120,
      timestampMs: 3000,
      endTimestampMs: 2000,
    })

    expect(updated).toBe(true)
    expect(state.drinkEntries[0]?.timestampMs).toBe(3000)
    expect(state.drinkEntries[0]?.ml).toBe(2000)
    expect(state.drinkEntries[0]?.percent).toBe(100)
    expect(state.drinkEntries[0]?.endTimestampMs).toBe(3000)
  })

  it('removes and clears drink entries', () => {
    state.drinkEntries = [
      { ml: 100, percent: 5, timestampMs: 1000, endTimestampMs: 2000 },
      { ml: 200, percent: 10, timestampMs: 2000, endTimestampMs: 3000 },
    ]

    expect(removeDrinkEntry(1000)).toBe(true)
    expect(state.drinkEntries).toHaveLength(1)
    expect(removeDrinkEntry(9999)).toBe(false)

    clearDrinkEntries()
    expect(state.drinkEntries).toHaveLength(0)
  })

  it('clamps bpm, ml and percent values', () => {
    setBpm(10)
    setDrinkMl(-50)
    setDrinkPercent(120)

    expect(state.bpm).toBe(60)
    expect(state.drinkMl).toBe(0)
    expect(state.drinkPercent).toBe(100)

    setBpm(999)
    setDrinkMl(99999)
    setDrinkPercent(-1)

    expect(state.bpm).toBe(200)
    expect(state.drinkMl).toBe(2000)
    expect(state.drinkPercent).toBe(0)
  })

  it('updates menu-related state fields', () => {
    state.menuVisible = true
    setMenuItem('setupdrink')
    setFocusedMenuItem('adddrink')
    setAddDrinkSubmenuVisible(true)

    expect(state.currentMenuItem).toBe('setupdrink')
    expect(state.menuVisible).toBe(false)
    expect(state.focusedMenuItem).toBe('adddrink')
    expect(state.addDrinkSubmenuVisible).toBe(true)
  })

  it('normalizes and clamps BAC settings including custom body water factor', () => {
    setBacSettings({
      weightKg: 10,
      ageYears: 200,
      heightCm: 500,
      sexAtBirth: 'female',
      useCustomBodyWaterFactor: true,
      customBodyWaterFactor: 1.2,
      eliminationRatePerHour: 1,
      absorptionMinutes: -3,
      foodProfile: 'invalid' as never,
    })

    const settings = getBacSettings()
    expect(settings.weightKg).toBe(35)
    expect(settings.ageYears).toBe(100)
    expect(settings.heightCm).toBe(230)
    expect(settings.customBodyWaterFactor).toBe(0.9)
    expect(settings.bodyWaterFactor).toBe(0.9)
    expect(settings.eliminationRatePerHour).toBe(0.04)
    expect(settings.absorptionMinutes).toBe(0)
    expect(settings.foodProfile).toBe('light')
  })

  it('recomputes auto body water factor when custom mode is disabled', () => {
    setBacSettings({
      useCustomBodyWaterFactor: true,
      customBodyWaterFactor: 0.4,
    })
    expect(getBacSettings().bodyWaterFactor).toBe(0.4)

    setBacSettings({ useCustomBodyWaterFactor: false })
    const settings = getBacSettings()
    expect(settings.bodyWaterFactor).toBeGreaterThanOrEqual(0.4)
    expect(settings.bodyWaterFactor).toBeLessThanOrEqual(0.9)
    expect(settings.bodyWaterFactor).not.toBe(0.4)
  })

  it('hydrates persisted state from bridge, prunes old entries, and re-saves', async () => {
    const now = Date.now()
    const oldEntryTs = now - (25 * 60 * 60 * 1000)

    const setLocalStorage = vi.fn(async () => undefined)
    const getLocalStorage = vi.fn(async () => JSON.stringify({
      bpm: 30,
      pacerRunning: true,
      drinkMl: 2500,
      drinkPercent: -5,
      drinkEntries: [
        { ml: 9999, percent: 999, timestampMs: oldEntryTs, endTimestampMs: oldEntryTs + 1000 },
        { ml: 333, percent: 11.5, timestampMs: now - 1000, endTimestampMs: now + 1000 },
      ],
      bacSettings: {
        weightKg: 999,
        sexAtBirth: 'male',
        ageYears: 10,
        heightCm: 500,
        useCustomBodyWaterFactor: false,
        customBodyWaterFactor: 0.1,
        bodyWaterFactor: 0.1,
        eliminationRatePerHour: 0.001,
        absorptionMinutes: 1000,
        foodProfile: 'heavy',
      },
    }))

    setBridge({
      getLocalStorage,
      setLocalStorage,
    } as never)

    await loadPersistedState()

    expect(state.bpm).toBe(60)
    expect(state.pacerRunning).toBe(true)
    expect(state.drinkMl).toBe(2000)
    expect(state.drinkPercent).toBe(0)
    expect(state.drinkEntries).toHaveLength(1)
    expect(state.drinkEntries[0]?.ml).toBe(333)
    expect(state.bacSettings.weightKg).toBe(250)
    expect(state.bacSettings.ageYears).toBe(18)
    expect(state.bacSettings.heightCm).toBe(230)
    expect(state.bacSettings.eliminationRatePerHour).toBe(0.005)
    expect(state.bacSettings.absorptionMinutes).toBe(240)
    expect(setLocalStorage).toHaveBeenCalledTimes(1)
  })

  it('formats BAC and drink entry time values', () => {
    expect(formatBacGdl(0)).toBe('0.000')
    expect(formatBacGdl(0.12345)).toBe('0.123')
    expect(formatDrinkEntryTime(0)).toMatch(/^\d{2}:\d{2}$/)
  })

  it('updates pacer running state', () => {
    setPacerRunning(true)
    expect(state.pacerRunning).toBe(true)
    setPacerRunning(false)
    expect(state.pacerRunning).toBe(false)
  })
})
