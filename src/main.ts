import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string) {
  console.log(`[ui] ${text}`)
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null
  const actionBtn = document.getElementById('actionBtn') as HTMLButtonElement | null
  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement | null
  const confirmResetModal = document.getElementById('confirmResetModal')
  const confirmResetBtn = document.getElementById('confirmResetBtn') as HTMLButtonElement | null
  const cancelResetBtn = document.getElementById('cancelResetBtn') as HTMLButtonElement | null

  document.title = `${app.name} – Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

  if (connectBtn && app.connectLabel) connectBtn.textContent = app.connectLabel
  if (actionBtn && app.actionLabel) actionBtn.textContent = app.actionLabel
  if (resetBtn && app.resetLabel) resetBtn.textContent = app.resetLabel

  const actions = await app.createActions(updateStatus)

  const openResetModal = () => {
    if (!confirmResetModal) return
    confirmResetModal.classList.remove('hidden')
  }

  const closeResetModal = () => {
    if (!confirmResetModal) return
    confirmResetModal.classList.add('hidden')
  }

  connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true
    try { await actions.connect() }
    catch (e) { console.error(e); updateStatus('Connect failed') }
    finally { connectBtn.disabled = false }
  })

  actionBtn?.addEventListener('click', async () => {
    actionBtn.disabled = true
    try { await actions.action() }
    catch (e) { console.error(e); updateStatus('Action failed') }
    finally { actionBtn.disabled = false }
  })

  if (actions.reset && resetBtn) {
    resetBtn.style.display = ''
    resetBtn.addEventListener('click', () => {
      openResetModal()
    })
  }

  cancelResetBtn?.addEventListener('click', () => {
    closeResetModal()
  })

  confirmResetBtn?.addEventListener('click', async () => {
    if (!actions.reset) return
    confirmResetBtn.disabled = true
    try {
      await actions.reset()
      closeResetModal()
    }
    catch (e) {
      console.error(e)
      updateStatus('Reset failed')
    }
    finally {
      confirmResetBtn.disabled = false
    }
  })

  confirmResetModal?.addEventListener('click', (event) => {
    if (event.target === confirmResetModal) {
      closeResetModal()
    }
  })

  void actions.connect().catch((e) => {
    console.error('[app-loader] auto-connect failed', e)
  })
}

void boot().catch((e) => {
  console.error('[app-loader] boot failed', e)
})
