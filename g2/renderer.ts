// Renderer for displaying content on Even G2 glasses
import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge, type MenuItem } from './state'

const MENU_ITEMS: { id: MenuItem; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
  { id: 'help', label: 'Help' },
]

let containersCreated = false

function getMenuItemLabel(item: MenuItem): string {
  const found = MENU_ITEMS.find((menuItem) => menuItem.id === item)
  return found?.label ?? 'Menu'
}

function getScreenBody(item: MenuItem): string {
  switch (item) {
    case 'home':
      return state.pacerRunning ? `Pacer: ${state.bpm} BPM` : 'Pacer Stopped'
    case 'settings':
      return `BPM: ${state.bpm}`
    case 'about':
      return 'Bacpacer v1.0'
    case 'help':
      return 'Swipe to change focus\nClick to open\nDouble-click to go back'
  }
}

export async function initMenu(): Promise<void> {
  const b = getBridge()
  if (!b) return

  // Create only the menu/content area at top-left
  const result = await b.createStartUpPageContainer(new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 2,
        containerName: 'content',
        content: 'Menu > Home',
        xPosition: 0,
        yPosition: 0,
        width: 500,
        height: 200,
        isEventCapture: 1,
      }),
    ],
  }))

  if (result === 0) { // success
    containersCreated = true
    console.log('Containers created successfully')
  } else {
    console.error('Failed to create containers:', result)
  }
}

export async function updateMenuDisplay(): Promise<void> {
  const b = getBridge()
  if (!b || !containersCreated) return

  const breadcrumb = state.menuVisible
    ? ''
    : `${getMenuItemLabel(state.currentMenuItem)}`

  if (!state.menuVisible) {
    // Detail view: keep breadcrumb and show body content only.
    await b.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 2,
      containerName: 'content',
      content: `${breadcrumb}\n\n${getScreenBody(state.currentMenuItem)}`,
    }))
    return
  }

  // Always show menu
  const menuContent = MENU_ITEMS.map((item) => {
    const focused = state.focusedMenuItem === item.id ? '[x]' : '[ ]'
    return `${focused} ${item.label}`
  }).join('\n')

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: 'content',
    content: `${breadcrumb}\n\n${menuContent}`,
  }))
}

export async function showContent(): Promise<void> {
  await updateMenuDisplay()
}

export async function updateDisplay(): Promise<void> {
  await showContent()
}
