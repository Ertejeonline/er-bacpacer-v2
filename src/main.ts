import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string): void {
  const status = document.getElementById('status')
  if (status) status.textContent = text
  console.log(`[ui] ${text}`)
}

async function boot(): Promise<void> {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  document.title = `${app.name} - Even Realities`
  updateStatus(app.initialStatus ?? 'App ready')

  const actions = await app.createActions(updateStatus)
  await actions.connect()
}

void boot().catch((error) => {
  console.error('[app-loader] boot failed', error)
  updateStatus('Boot failed. Open dev tools for details.')
})
