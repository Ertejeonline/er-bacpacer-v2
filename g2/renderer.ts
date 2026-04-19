// Renderer for displaying content on Even G2 glasses
import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge, type MenuItem } from './state'

const MENU_ITEMS: { id: MenuItem; label: string }[] = [
  { id: 'home', label: '' },
  { id: 'adddrink', label: 'Add drink' },
  { id: 'setupdrink', label: 'Setup drink' },
  { id: 'help', label: 'Help' },
]

let containersCreated = false

const SCREEN_WIDTH = 576
const SCREEN_HEIGHT = 288
const SIDE_WIDTH = SCREEN_WIDTH / 2
const SIDE_HEIGHT = 30
const MAIN_Y = SIDE_HEIGHT
const MAIN_HEIGHT = SCREEN_HEIGHT - 2 * SIDE_HEIGHT
const MAIN_WIDTH = SCREEN_WIDTH / 2

function buildStaticTextContainers(): TextContainerProperty[] {
  return [
    new TextContainerProperty({
      containerID: 1,
      containerName: 'TopLeftContainer',
      content: '',
      xPosition: 0,
      yPosition: 0,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 2,
      containerName: 'TopRightContainer',
      content: 'TopRightContainer',
      xPosition: SIDE_WIDTH,
      yPosition: 0,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 4,
      containerName: 'MainRight',
      content: 'MainRight',
      xPosition: MAIN_WIDTH,
      yPosition: MAIN_Y,
      width: MAIN_WIDTH,
      height: MAIN_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 5,
      containerName: 'BottomLeftContainer',
      content: 'BottomLeftContainer',
      xPosition: 0,
      yPosition: SCREEN_HEIGHT - SIDE_HEIGHT,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
    new TextContainerProperty({
      containerID: 6,
      containerName: 'BottomRightContainer',
      content: 'BottomRightContainer',
      xPosition: SIDE_WIDTH,
      yPosition: SCREEN_HEIGHT - SIDE_HEIGHT,
      width: SIDE_WIDTH,
      height: SIDE_HEIGHT,
    }),
  ]
}

async function showMenuListLayout(): Promise<void> {
  const b = getBridge()
  if (!b) return

  const textContainers = buildStaticTextContainers()

  const menuList = new ListContainerProperty({
    containerID: 3,
    containerName: 'MainLeftMenu',
    xPosition: 0,
    yPosition: MAIN_Y,
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    paddingLength: 4,
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: MENU_ITEMS.length,
      itemWidth: MAIN_WIDTH - 10,
      isItemSelectBorderEn: 1,
      itemName: MENU_ITEMS.map(item => item.label || 'Home'),
    }),
  })

  if (!containersCreated) {
    const result = await b.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 6,
      textObject: textContainers,
      listObject: [menuList],
    }))
    if (result === 0) {
      containersCreated = true
      console.log('Containers created successfully')
    } else {
      console.error('Failed to create containers:', result)
    }
    return
  }

  await b.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: 6,
    textObject: textContainers,
    listObject: [menuList],
  }))
}

async function showDetailLayout(body: string): Promise<void> {
  const b = getBridge()
  if (!b) return

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

  if (!containersCreated) {
    const result = await b.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 6,
      textObject: textContainers,
    }))
    if (result === 0) {
      containersCreated = true
      console.log('Containers created successfully')
    } else {
      console.error('Failed to create containers:', result)
    }
    return
  }

  await b.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: 6,
    textObject: textContainers,
  }))
}

export function menuItemFromIndex(index: number): MenuItem | undefined {
  return MENU_ITEMS[index]?.id
}

function getMenuItemLabel(item: MenuItem): string {
  const found = MENU_ITEMS.find((menuItem) => menuItem.id === item)
  return found?.label ?? 'Menu'
}

function getScreenBody(item: MenuItem): string {
  switch (item) {
    case 'home':
      return ''
    case 'adddrink':
      return `BPM: ${state.bpm}`
    case 'setupdrink':
      return 'Bacpacer v1.0'
    case 'help':
      return 'Swipe to change focus\nClick to open\nDouble-click to go back'
  }
}

export async function initMenu(): Promise<void> {
  await showMenuListLayout()
}

export async function updateMenuDisplay(): Promise<void> {
  const b = getBridge()
  if (!b || !containersCreated) return

  const breadcrumb = state.menuVisible
    ? 'Menu'
    : `${getMenuItemLabel(state.currentMenuItem)}`

  if (!state.menuVisible) {
    const body = getScreenBody(state.currentMenuItem)
    await showDetailLayout(body)
  } else {
    await showMenuListLayout()
  }

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: 'TopLeftContainer',
    content: breadcrumb,
  }))
}

export async function showContent(): Promise<void> {
  await updateMenuDisplay()
}

export async function updateDisplay(): Promise<void> {
  await showContent()
}
