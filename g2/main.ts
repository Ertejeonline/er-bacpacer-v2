import type { SetStatus, AppActions } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'

export async function createBacpacerActions(setStatus: SetStatus): Promise<AppActions> {
  const actions: AppActions = {
    connect: async () => {
      setStatus('Connecting to device...')
      appendEventLog('Connection initiated')
      // TODO: Implement device connection logic
      setStatus('Connected')
    },

    action: async () => {
      setStatus('Starting pacer...')
      appendEventLog('Pacer started')
      // TODO: Implement pacer start logic
      setStatus('Pacer running')
    },
  }

  return actions
}
