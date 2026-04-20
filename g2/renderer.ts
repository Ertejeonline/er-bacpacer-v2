// Renderer for displaying content on Even G2 glasses
import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { formatDrinkEntryTime, state, getBridge, type MenuItem } from './state'

const MENU_ITEMS: { id: MenuItem; label: string }[] = [
  { id: 'home', label: '' },
  { id: 'adddrink', label: 'Add drink' },
  { id: 'setupdrink', label: 'Summary' },
  { id: 'reset', label: 'Reset' },
]

const ADD_DRINK_MENU_ITEMS = [
  'Add drink',
  '+ ml',
  '- ml',
  '+ %',
  '- %',
]

const RESET_CONFIRM_MENU_ITEMS = [
  'No',
  'Yes',
]

let containersCreated = false
type LayoutMode = 'main-menu' | 'adddrink-menu' | 'reset-confirm' | 'detail'
let currentLayoutMode: LayoutMode | null = null
let renderQueue: Promise<void> = Promise.resolve()

const SCREEN_WIDTH = 576
const SCREEN_HEIGHT = 288
const SIDE_WIDTH = SCREEN_WIDTH / 2
const SIDE_HEIGHT = 30
const MAIN_Y = SIDE_HEIGHT
const MAIN_HEIGHT = SCREEN_HEIGHT - 2 * SIDE_HEIGHT
const MAIN_WIDTH = SCREEN_WIDTH / 2
const MAX_RIGHT_HISTORY_LINES = 8
const MAX_RIGHT_CONTENT_CHARS = 900

type PageConfig = {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
}

function trimForRebuild(content: string): string {
  if (content.length <= MAX_RIGHT_CONTENT_CHARS) return content
  return `${content.slice(0, MAX_RIGHT_CONTENT_CHARS - 3)}...`
}

function runSerializedRender(task: () => Promise<void>): Promise<void> {
  const next = renderQueue.then(task, task).catch((err) => {
    console.warn('[bacpacer] render operation failed', err)
    appendEventLog('Renderer: operation failed')
  })
  renderQueue = next
  return next
}

function getTopRightContent(): string {
  const latest = state.drinkEntries[0]
  if (!latest) return ''

  const percentFraction = latest.percent > 1 ? latest.percent / 100 : latest.percent
  const intervalMinutes = (latest.ml * percentFraction) / 0.5
  const nextDrinkAtMs = latest.timestampMs + intervalMinutes * 60_000
  const remainingMinutes = Math.round((nextDrinkAtMs - Date.now()) / 60_000)
  if (remainingMinutes <= 0) return ''
  return `${remainingMinutes} minutes left`
}

function getMainRightContent(): string {
  const inAddDrinkContext = state.addDrinkSubmenuVisible || (!state.menuVisible && state.currentMenuItem === 'adddrink')
  if (!inAddDrinkContext) return ''

  const latest = `${state.drinkMl} ml    ${state.drinkPercent} %`
  const historyLines = state.drinkEntries.slice(0, MAX_RIGHT_HISTORY_LINES).map((entry) => {
    return `${formatDrinkEntryTime(entry.timestampMs)}  ${entry.ml} ml  ${entry.percent}%`
  })

  const history = historyLines.length > 0
    ? historyLines.join('\n')
    : 'No drinks stored yet'

  return trimForRebuild(`${latest}\n\nDrinks:\n${history}`)
}

function buildStaticTextContainers(): TextContainerProperty[] {
  return [
    new TextContainerProperty({
      containerID: 1,
      containerName: 'TopLeft',
      content: '',
      xPosition: 0,
      yPosition: 0,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 2,
      containerName: 'TopRight',
      content: getTopRightContent(),
      xPosition: SIDE_WIDTH,
      yPosition: 0,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 4,
      containerName: 'MainRight',
      content: getMainRightContent(),
      xPosition: MAIN_WIDTH,
      yPosition: MAIN_Y,
      width: MAIN_WIDTH,
      height: MAIN_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 5,
      containerName: 'BottomLeft',
      content: 'BottomLeft',
      xPosition: 0,
      yPosition: SCREEN_HEIGHT - SIDE_HEIGHT,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 6,
      containerName: 'BottomRight',
      content: 'BottomRight',
      xPosition: SIDE_WIDTH,
      yPosition: SCREEN_HEIGHT - SIDE_HEIGHT,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
  ]
}

async function createPage(config: PageConfig): Promise<boolean> {
  const b = getBridge()
  if (!b) return false

  const result = await b.createStartUpPageContainer(new CreateStartUpPageContainer(config))
  if (result === 0) {
    containersCreated = true
    return true
  }

  appendEventLog(`Renderer: create failed code=${String(result)}`)
  return false
}

async function rebuildPage(config: PageConfig): Promise<boolean> {
  const b = getBridge()
  if (!b) return false

  return b.rebuildPageContainer(new RebuildPageContainer(config))
}

async function applyPage(config: PageConfig): Promise<boolean> {
  // First render in this runtime.
  if (!containersCreated) {
    return createPage(config)
  }

  // Normal path: rebuild existing page.
  const rebuilt = await rebuildPage(config)
  if (rebuilt) return true

  // Recovery path: page may have been torn down or lost; recreate.
  appendEventLog('Renderer: rebuild failed, retrying create')
  containersCreated = false
  return createPage(config)
}

async function updateTopRightCountdownOnlyInternal(): Promise<void> {
  const b = getBridge()
  if (!b || !containersCreated) return

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: 'TopRight',
    content: getTopRightContent(),
  }))
}

async function updateRightDynamicContentOnlyInternal(): Promise<void> {
  const b = getBridge()
  if (!b || !containersCreated) return

  await updateTopRightCountdownOnlyInternal()

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 4,
    containerName: 'MainRight',
    content: getMainRightContent(),
  }))
}

async function updateMenuDisplayInternal(): Promise<void> {
  const b = getBridge()
  if (!b) return

  const breadcrumb = state.menuVisible
    ? (state.resetConfirmVisible ? 'Are you sure?' : (state.addDrinkSubmenuVisible ? 'Add drink' : 'Menu'))
    : `${getMenuItemLabel(state.currentMenuItem)}`

  const targetLayoutMode: LayoutMode = !state.menuVisible
    ? 'detail'
    : (state.resetConfirmVisible ? 'reset-confirm' : (state.addDrinkSubmenuVisible ? 'adddrink-menu' : 'main-menu'))

  const needsFullLayoutRender = !containersCreated || targetLayoutMode !== currentLayoutMode

  if (needsFullLayoutRender) {
    let rendered = false
    if (targetLayoutMode === 'detail') {
      const body = getScreenBody(state.currentMenuItem)
      rendered = await showDetailLayout(body)
    } else if (targetLayoutMode === 'reset-confirm') {
      rendered = await showResetConfirmListLayout()
    } else if (targetLayoutMode === 'adddrink-menu') {
      rendered = await showAddDrinkMenuListLayout()
    } else {
      rendered = await showMainMenuListLayout()
    }

    if (rendered) {
      currentLayoutMode = targetLayoutMode
    } else {
      // Keep previous mode when render fails to avoid UI/state desync.
      return
    }
  } else if (targetLayoutMode === 'detail') {
    // Same detail layout: update only text content without rebuilding page.
    const body = getScreenBody(state.currentMenuItem)
    await b.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 3,
      containerName: 'MainLeftDetail',
      content: body,
    }))
  }

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: 'TopLeft',
    content: breadcrumb,
  }))

  await updateRightDynamicContentOnlyInternal()
}

async function showMenuListLayout(items: string[], name: string): Promise<boolean> {
  const textContainers = buildStaticTextContainers()

  const menuList = new ListContainerProperty({
    containerID: 3,
    containerName: name,
    xPosition: 0,
    yPosition: MAIN_Y,
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    paddingLength: 4,
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: MAIN_WIDTH - 10,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
  })

  return applyPage({
    containerTotalNum: 6,
    textObject: textContainers,
    listObject: [menuList],
  })
}

async function showMainMenuListLayout(): Promise<boolean> {
  return showMenuListLayout(MENU_ITEMS.map(item => item.label || 'Home'), 'MainLeftMenu')
}

async function showAddDrinkMenuListLayout(): Promise<boolean> {
  return showMenuListLayout(ADD_DRINK_MENU_ITEMS, 'AddDrinkMenu')
}

async function showDetailLayout(body: string): Promise<boolean> {
  const textContainers = [
    ...buildStaticTextContainers(),
    new TextContainerProperty({
      containerID: 3,
      containerName: 'MainLeftDetail',
      content: body,
      xPosition: 0,
      yPosition: MAIN_Y,
      width: MAIN_WIDTH,
      height: MAIN_HEIGHT,
      isEventCapture: 1,
    }),
  ]

  return applyPage({
    containerTotalNum: 6,
    textObject: textContainers,
  })
}

async function showResetConfirmListLayout(): Promise<boolean> {
  return showMenuListLayout(RESET_CONFIRM_MENU_ITEMS, 'ResetConfirmMenu')
}

export function menuItemFromIndex(index: number): MenuItem | undefined {
  return MENU_ITEMS[index]?.id
}

export function addDrinkSubmenuItemFromIndex(index: number): string | undefined {
  return ADD_DRINK_MENU_ITEMS[index]
}

export function resetConfirmChoiceFromIndex(index: number): 'yes' | 'no' | undefined {
  if (index === 0) return 'no'
  if (index === 1) return 'yes'
  return undefined
}

function getMenuItemLabel(item: MenuItem): string {
  if (item === 'setupdrink') return 'Settings > Summary'
  const found = MENU_ITEMS.find((menuItem) => menuItem.id === item)
  return found?.label ?? 'Menu'
}

function getScreenBody(item: MenuItem): string {
  switch (item) {
    case 'home':
      return ''
    case 'adddrink':
      return `Add drink\nVolume: ${state.drinkMl} ml\nStrength: ${state.drinkPercent}%`
    case 'setupdrink':
      return 'Bacpacer v1.0'
    case 'reset':
      return 'Reset selected'
  }
}

export async function initMenu(): Promise<void> {
  await runSerializedRender(async () => {
    const ok = await showMainMenuListLayout()
    if (ok) {
      currentLayoutMode = 'main-menu'
    }
  })
}

export async function updateTopRightCountdownOnly(): Promise<void> {
  await runSerializedRender(updateTopRightCountdownOnlyInternal)
}

export async function updateRightDynamicContentOnly(): Promise<void> {
  await runSerializedRender(updateRightDynamicContentOnlyInternal)
}

export async function updateMenuDisplay(): Promise<void> {
  await runSerializedRender(updateMenuDisplayInternal)
}

export async function showContent(): Promise<void> {
  await updateMenuDisplay()
}

export async function updateDisplay(): Promise<void> {
  await showContent()
}

export function resetRendererSession(): void {
  containersCreated = false
  currentLayoutMode = null
  renderQueue = Promise.resolve()
}
