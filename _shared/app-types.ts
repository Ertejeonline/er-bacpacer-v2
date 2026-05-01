export type SetStatus = (text: string) => void

export type DrinkEntry = {
  ml: number
  percent: number
  timestampMs: number
}

export type AppActions = {
  connect: () => Promise<void>
  action: () => Promise<void>
  reset?: () => Promise<void>
  getDrinkEntries?: () => DrinkEntry[]
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
