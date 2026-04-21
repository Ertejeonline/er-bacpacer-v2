import { createAppActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'er-bacpacer',
  name: 'ER Bacpacer',
  initialStatus: 'App ready',
  createActions: createAppActions,
}

export default app
