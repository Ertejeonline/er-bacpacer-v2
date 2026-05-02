export type SetStatus = (text: string) => void

export type DrinkEntry = {
  ml: number
  percent: number
  timestampMs: number
}

export type BacFoodProfile = 'empty' | 'light' | 'heavy'

export type BacSexAtBirth = 'male' | 'female'

export type BacUserSettings = {
  weightKg: number
  sexAtBirth: BacSexAtBirth
  ageYears: number
  heightCm: number
  useCustomBodyWaterFactor: boolean
  customBodyWaterFactor: number
  bodyWaterFactor: number
  eliminationRatePerHour: number
  absorptionMinutes: number
  foodProfile: BacFoodProfile
}

export type BacEstimate = {
  bacGdl: number
  absorbedAlcoholGrams: number
  hoursSinceFirstDrink: number
  estimatedSoberAtMs: number | null
}

export type AppActions = {
  connect: () => Promise<void>
  action: () => Promise<void>
  reset?: () => Promise<void>
  getDrinkEntries?: () => DrinkEntry[]
  removeDrinkEntry?: (timestampMs: number) => void
  updateDrinkEntry?: (originalTimestampMs: number, nextEntry: DrinkEntry) => boolean
  getBacSettings?: () => BacUserSettings
  updateBacSettings?: (next: Partial<BacUserSettings>) => void
  getBacEstimate?: () => BacEstimate
}

export type AppModule = {
  id: string
  name: string
  pageTitle?: string
  connectLabel?: string
  actionLabel?: string
  resetLabel?: string
  initialStatus?: string
  createActions: (setStatus: SetStatus) => Promise<AppActions> | AppActions
}
