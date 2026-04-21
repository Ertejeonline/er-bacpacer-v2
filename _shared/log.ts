export function appendEventLog(text: string): void {
  const el = document.getElementById('event-log')
  if (!el) return

  const now = new Date().toLocaleTimeString()
  const line = `[${now}] ${text}`
  el.textContent = el.textContent ? `${el.textContent}\n${line}` : line

  const lines = (el.textContent ?? '').split('\n')
  if (lines.length > 250) {
    el.textContent = lines.slice(-250).join('\n')
  }

  el.scrollTop = el.scrollHeight
}
