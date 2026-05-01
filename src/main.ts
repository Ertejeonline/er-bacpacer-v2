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
  const editDrinkModal = document.getElementById('editDrinkModal')
  const editDrinkTimeInput = document.getElementById('editDrinkTimeInput') as HTMLInputElement | null
  const editDrinkMlInput = document.getElementById('editDrinkMlInput') as HTMLInputElement | null
  const editDrinkPercentInput = document.getElementById('editDrinkPercentInput') as HTMLInputElement | null
  const saveEditDrinkBtn = document.getElementById('saveEditDrinkBtn') as HTMLButtonElement | null
  const cancelEditDrinkBtn = document.getElementById('cancelEditDrinkBtn') as HTMLButtonElement | null

  document.title = `${app.name} – Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

  if (resetBtn && app.resetLabel) resetBtn.textContent = app.resetLabel

  const actions = await app.createActions(updateStatus)
  let pendingDeleteTimestampMs: number | null = null
  let editingDrinkTimestampMs: number | null = null

  const formatTimeInputValue = (timestampMs: number) => {
    const date = new Date(timestampMs)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const closeEditDrinkModal = () => {
    editingDrinkTimestampMs = null
    editDrinkModal?.classList.add('hidden')
  }

  const openEditDrinkModal = (timestampMs: number) => {
    if (!editDrinkModal || !actions.getDrinkEntries || !editDrinkTimeInput || !editDrinkMlInput || !editDrinkPercentInput) return

    const entry = actions.getDrinkEntries().find((candidate) => candidate.timestampMs === timestampMs)
    if (!entry) return

    editingDrinkTimestampMs = entry.timestampMs
    editDrinkTimeInput.value = formatTimeInputValue(entry.timestampMs)
    editDrinkMlInput.value = String(entry.ml)
    editDrinkPercentInput.value = entry.percent.toFixed(1)
    editDrinkModal.classList.remove('hidden')
  }

  const closeDeleteDrinkModal = () => {
    pendingDeleteTimestampMs = null
    confirmDeleteDrinkModal?.classList.add('hidden')
  }

  const renderDrinksLog = () => {
    if (!drinksLogList || !actions.getDrinkEntries) return

    const entries = actions.getDrinkEntries()
    drinksLogList.innerHTML = ''
    for (const entry of entries) {
      const d = new Date(entry.timestampMs)
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const row = document.createElement('div')
      row.className = 'drink-log-row'
      row.tabIndex = 0
      row.setAttribute('role', 'button')
      row.setAttribute('aria-label', `Edit ${entry.ml} ml at ${time}`)
      row.addEventListener('click', () => {
        openEditDrinkModal(entry.timestampMs)
      })
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        openEditDrinkModal(entry.timestampMs)
      })

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
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation()
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

  if (actions.reset && resetBtn) {
    resetBtn.style.display = ''
    resetBtn.addEventListener('click', openResetModal)
  }

  cancelResetBtn?.addEventListener('click', closeResetModal)

  confirmResetBtn?.addEventListener('click', async () => {
    if (!actions.reset) return
    confirmResetBtn.disabled = true
    try {
      await actions.reset()
      closeResetModal()
      renderDrinksLog()
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

  cancelEditDrinkBtn?.addEventListener('click', closeEditDrinkModal)
  saveEditDrinkBtn?.addEventListener('click', () => {
    if (
      editingDrinkTimestampMs === null
      || !editDrinkTimeInput
      || !editDrinkMlInput
      || !editDrinkPercentInput
      || !actions.updateDrinkEntry
    ) {
      return
    }

    const timeValue = editDrinkTimeInput.value
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
    const ml = Number(editDrinkMlInput.value)
    const percent = Number(editDrinkPercentInput.value)

    if (!timeMatch || !Number.isFinite(ml) || !Number.isFinite(percent)) {
      updateStatus('Enter a valid time, amount, and alcohol percentage')
      return
    }

    const existingEntry = actions.getDrinkEntries?.().find((entry) => entry.timestampMs === editingDrinkTimestampMs)
    if (!existingEntry) {
      updateStatus('Drink entry no longer exists')
      closeEditDrinkModal()
      renderDrinksLog()
      return
    }

    const nextTimestamp = new Date(existingEntry.timestampMs)
    nextTimestamp.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0)

    const updated = actions.updateDrinkEntry(editingDrinkTimestampMs, {
      timestampMs: nextTimestamp.getTime(),
      ml,
      percent,
    })

    if (!updated) {
      updateStatus('Drink update failed')
      return
    }

    closeEditDrinkModal()
    renderDrinksLog()
  })
  editDrinkModal?.addEventListener('click', (event) => {
    if (event.target === editDrinkModal) {
      closeEditDrinkModal()
    }
  })

  void actions.connect().catch((e) => {
    console.error('[app-loader] auto-connect failed', e)
  })
}

void boot().catch((e) => {
  console.error('[app-loader] boot failed', e)
})
