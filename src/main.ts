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
  const confirmDeleteDrinkModal = document.getElementById('confirmDeleteDrinkModal')
  const confirmDeleteDrinkText = document.getElementById('confirmDeleteDrinkText')
  const confirmDeleteDrinkBtn = document.getElementById('confirmDeleteDrinkBtn') as HTMLButtonElement | null
  const cancelDeleteDrinkBtn = document.getElementById('cancelDeleteDrinkBtn') as HTMLButtonElement | null

  document.title = `${app.name} – Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

  if (resetBtn && app.resetLabel) resetBtn.textContent = app.resetLabel

  const actions = await app.createActions(updateStatus)
  let pendingDeleteTimestampMs: number | null = null

  const closeDeleteDrinkModal = () => {
    pendingDeleteTimestampMs = null
    confirmDeleteDrinkModal?.classList.add('hidden')
  }

  const renderDrinksLog = () => {
    if (!drinksLogList || !actions.getDrinkEntries) return

    const entries = actions.getDrinkEntries()
    drinksLogList.innerHTML = ''
    for (const entry of entries) {
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

      const deleteBtn = document.createElement('button')
      deleteBtn.type = 'button'
      deleteBtn.className = 'drink-log-delete-btn'
      deleteBtn.setAttribute('aria-label', `Delete ${entry.ml} ml at ${time}`)
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm1 12a2 2 0 0 1-2-2V8h12v11a2 2 0 0 1-2 2H8z" fill="currentColor"/></svg>'
      deleteBtn.addEventListener('click', () => {
        pendingDeleteTimestampMs = entry.timestampMs
        if (confirmDeleteDrinkText) {
          confirmDeleteDrinkText.textContent = `Delete ${entry.ml} ml at ${entry.percent.toFixed(1)}% from ${time}?`
        }
        confirmDeleteDrinkModal?.classList.remove('hidden')
      })

      row.appendChild(timeEl)
      row.appendChild(detailEl)
      row.appendChild(deleteBtn)
      drinksLogList.appendChild(row)
    }
  }

  const openResetModal = () => {
    if (!confirmResetModal) return
    confirmResetModal.classList.remove('hidden')
  }

  const closeResetModal = () => {
    if (!confirmResetModal) return
    confirmResetModal.classList.add('hidden')
  }

  const openDrinksLog = () => {
    if (!drinksLogModal || !drinksLogList || !actions.getDrinkEntries) return

    renderDrinksLog()
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

  cancelDeleteDrinkBtn?.addEventListener('click', closeDeleteDrinkModal)
  confirmDeleteDrinkBtn?.addEventListener('click', () => {
    if (pendingDeleteTimestampMs === null) return
    actions.removeDrinkEntry?.(pendingDeleteTimestampMs)
    closeDeleteDrinkModal()
    renderDrinksLog()
  })
  confirmDeleteDrinkModal?.addEventListener('click', (event) => {
    if (event.target === confirmDeleteDrinkModal) {
      closeDeleteDrinkModal()
    }
  })

  void actions.connect().catch((e) => {
    console.error('[app-loader] auto-connect failed', e)
  })
}

void boot().catch((e) => {
  console.error('[app-loader] boot failed', e)
})
