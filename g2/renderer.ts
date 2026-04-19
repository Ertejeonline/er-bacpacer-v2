// Renderer for displaying content on Even G2 glasses
import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge, toggleMenu, setMenuItem, type MenuItem } from './state'

const MENU_ITEMS: { id: MenuItem; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
  { id: 'help', label: 'Help' },
]

let containersCreated = false

export async function initMenu(): Promise<void> {
  const b = getBridge()
  if (!b) return

  // Create initial page with menu button and content area
  const result = await b.createStartUpPageContainer(new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [
      // Menu button at top-left (0,0)
      new TextContainerProperty({
        containerID: 1,
        containerName: 'menu_button',
        content: 'Menu',
        xPosition: 0,
        yPosition: 0,
        width: 50,
        height: 30,
        borderWidth: 2,
        borderColor: 15, // white border
        borderRadius: 4,
        isEventCapture: 1, // This container captures events
      }),
      // Content area
      new TextContainerProperty({
        containerID: 2,
        containerName: 'content',
        content: 'Menu',
        xPosition: 50,
        yPosition: 50,
        width: 500,
        height: 200,
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

  if (state.menuOpen) {
    // Show menu items by updating content with menu options
    const menuContent = MENU_ITEMS.map((item, index) =>
      `${index + 1}. ${item.label}${state.currentMenuItem === item.id ? ' ←' : ''}`
    ).join('\n')

    await b.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 2,
      containerName: 'content',
      content: `Menu (tap to cycle):\n${menuContent}`,
    }))
  } else {
    // Show normal content
    await showContent()
  }
}

export async function showContent(): Promise<void> {
  const b = getBridge()
  if (!b) return

  // Render content based on current menu item
  let content = ''
  switch (state.currentMenuItem) {
    case 'home':
      content = state.pacerRunning ? `Pacer: ${state.bpm} BPM` : 'Pacer Stopped'
      break
    case 'settings':
      content = `BPM: ${state.bpm}`
      break
    case 'about':
      content = 'Bacpacer v1.0'
      break
    case 'help':
      content = 'Tap hamburger to open menu\nTap again to cycle items'
      break
  }

  await b.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: 'content',
    content: content,
  }))
}

export async function updateDisplay(): Promise<void> {
  await showContent()
}
