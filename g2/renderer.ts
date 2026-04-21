import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { getBridge, MENU_ITEMS, runBridgeTask, state } from './state'

const WIDTH = 576
const HEIGHT = 288

type PageConfig = {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
}

async function renderPage(config: PageConfig): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  await runBridgeTask(async () => {
    if (!state.startupRendered) {
      const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
      if (result !== 0) {
        throw new Error(`createStartUpPageContainer failed with code ${String(result)}`)
      }
      state.startupRendered = true
      return
    }

    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  })
}

function sessionText(): string {
  const minutes = Math.floor(state.sessionSeconds / 60)
  const seconds = state.sessionSeconds % 60
  const progress = Math.max(0, Math.min(20, Math.round((state.sessionSeconds / 300) * 20)))
  const bar = `${'='.repeat(progress)}${'-'.repeat(20 - progress)}`

  return [
    'ER BACPACER',
    '',
    `Time left: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    `[${bar}]`,
    '',
    state.running ? 'Tap: pause timer' : 'Tap: resume timer',
    'Swipe up: +1 min',
    'Swipe down: -1 min',
    'Double-tap: back to menu',
    '',
    `Last event: ${state.lastEvent}`,
  ].join('\n')
}

export async function showMenu(): Promise<void> {
  state.screen = 'menu'

  await renderPage({
    containerTotalNum: 1,
    listObject: [
      new ListContainerProperty({
        containerID: 1,
        containerName: 'menu',
        xPosition: 0,
        yPosition: 0,
        width: WIDTH,
        height: HEIGHT,
        borderWidth: 1,
        borderColor: 6,
        borderRadius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: MENU_ITEMS.length,
          itemWidth: WIDTH - 10,
          isItemSelectBorderEn: 1,
          itemName: MENU_ITEMS,
        }),
      }),
    ],
  })

  appendEventLog('Rendered menu')
}

export async function showSession(): Promise<void> {
  state.screen = 'session'

  await renderPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'main',
        content: sessionText(),
        xPosition: 0,
        yPosition: 0,
        width: WIDTH,
        height: HEIGHT,
        isEventCapture: 1,
        paddingLength: 8,
        borderWidth: 1,
        borderColor: 4,
      }),
    ],
  })

  appendEventLog('Rendered session screen')
}

export async function upgradeSessionText(): Promise<void> {
  if (state.screen !== 'session') return
  const bridge = getBridge()
  if (!bridge) return

  await runBridgeTask(async () => {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 1,
      containerName: 'main',
      content: sessionText(),
    }))
  })
}

export async function showAbout(): Promise<void> {
  state.screen = 'about'

  await renderPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'about',
        content: [
          'ER BACPACER',
          '',
          'A focus timer for Even Realities glasses.',
          '',
          'Controls',
          'Tap: select or pause/resume',
          'Swipe: adjust timer',
          'Double-tap: back',
          '',
          'Built with Even Hub SDK 0.0.10+',
          `Version: ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`,
        ].join('\n'),
        xPosition: 0,
        yPosition: 0,
        width: WIDTH,
        height: HEIGHT,
        isEventCapture: 1,
        paddingLength: 8,
      }),
    ],
  })

  appendEventLog('Rendered about screen')
}
