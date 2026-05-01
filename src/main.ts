import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string) {
  console.log(`[ui] ${text}`)
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement | null
  const confirmResetModal = document.getElementById('confirmResetModal')
  const confirmResetBtn = document.getElementById('confirmResetBtn') as HTMLButtonElement | null
  const cancelResetBtn = document.getElementById('cancelResetBtn') as HTMLButtonElement | null
  const drinksLogBtn = document.getElementById('drinksLogBtn') as HTMLButtonElement | null
  const drinksLogModal = document.getElementById('drinksLogModal')
  const drinksLogList = document.getElementById('drinksLogList')
  const closeDrinksLogBtn = document.getElementById('closeDrinksLogBtn') as HTMLButtonElement | null

  document.title = `${app.name} – Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

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

  const openDrinksLog = () => {
    if (!drinksLogModal || !drinksLogList || !actions.getDrinkEntries) return
    const entries = actions.getDrinkEntries()
    drinksLogList.innerHTML = ''
    for (const entry of [...entries].reverse()) {
      const row = document.createElement('div')
      row.className = 'drink-log-row'
      const d = new Date(entry.timestampMs)
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const timeEl = document.createElement('span')
      timeEl.className = 'drink-log-time'
      timeEl.textContent = time
      const detailEl = document.createElement('span')
      detailEl.className = 'drink-log-details'
      detailEl.textContent = `${entry.ml} ml · ${entry.percent.toFixed(1)}%`
      row.appendChild(timeEl)
      row.appendChild(detailEl)
      drinksLogList.appendChild(row)
    }
    drinksLogModal.classList.remove('hidden')
  }

  const closeDrinksLog = () => {
    drinksLogModal?.classList.add('hidden')
  }

  if (actions.getDrinkEntries && drinksLogBtn) {
    drinksLogBtn.style.display = ''
    drinksLogBtn.addEventListener('click', openDrinksLog)
  }

  closeDrinksLogBtn?.addEventListener('click', closeDrinksLog)
  drinksLogModal?.addEventListener('click', (event) => {
    if (event.target === drinksLogModal) {
      closeDrinksLog()
    }
  })

  void actions.connect().catch((e) => {
    console.error('[app-loader] auto-connect failed', e)
  })
}

void boot().catch((e) => {
  console.error('[app-loader] boot failed', e)
})
