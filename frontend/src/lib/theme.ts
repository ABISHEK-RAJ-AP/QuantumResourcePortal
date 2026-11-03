export type AppTheme = 'light' | 'dark'

const KEY = 'qrp_theme'

export function readTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  window.dispatchEvent(new CustomEvent('qrp-theme-changed', { detail: { theme } }))
}

export function setTheme(theme: AppTheme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(readTheme())
}
