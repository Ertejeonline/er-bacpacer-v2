import { createBacpacerActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'bacpacer',
  name: 'Bacpacer',
  connectLabel: 'Connect',
  actionLabel: 'Start',
  initialStatus: 'Bacpacer ready',
  createActions: createBacpacerActions,
}

export default app
