import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { cleanupApp, resetAndStartSession, toggleSession, adjustSession } from './app'
import { showAbout, showMenu } from './renderer'
import { getBridge, state } from './state'

function resolveEventType(event: EvenHubEvent): number | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType

  if (typeof raw === 'number') return raw
  return undefined
}

function resolveListSelection(event: EvenHubEvent): number {
  const selected = event.listEvent?.currentSelectItemIndex ?? 0
  return selected < 0 ? 0 : selected
}

async function onMenuClick(event: EvenHubEvent): Promise<void> {
  const selected = resolveListSelection(event)

  if (selected === 0) {
    await resetAndStartSession()
    return
  }

  if (selected === 1) {
    await showAbout()
    return
  }

  const bridge = getBridge()
  if (bridge) {
    await bridge.shutDownPageContainer(1)
  }
}

export async function onEvenHubEvent(event: EvenHubEvent): Promise<void> {
  const eventType = resolveEventType(event)
  if (typeof eventType !== 'number') return

  state.lastEvent = String(eventType)
  appendEventLog(`eventType=${String(eventType)} screen=${state.screen}`)

  if (eventType === 6 || eventType === 7) {
    await cleanupApp()
    return
  }

  if (state.screen === 'menu') {
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      await onMenuClick(event)
      return
    }

    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      const bridge = getBridge()
      if (bridge) {
        await bridge.shutDownPageContainer(1)
      }
    }
    return
  }

  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    await showMenu()
    return
  }

  if (state.screen === 'session') {
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      await toggleSession()
      return
    }

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      await adjustSession(60)
      return
    }

    if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      await adjustSession(-60)
      return
    }
    return
  }

  if (state.screen === 'about' && eventType === OsEventTypeList.CLICK_EVENT) {
    await showMenu()
  }
}
