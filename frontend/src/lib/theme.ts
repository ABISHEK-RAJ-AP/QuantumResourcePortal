export type ThemePreference = 'light' | 'dark' | 'system'
/** Resolved appearance after system preference is applied. */
export type AppTheme = 'light' | 'dark'

const KEY = 'qrp_theme'

export function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): AppTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

/** @deprecated prefer readPreference; kept for call sites that expect a resolved value. */
export function readTheme(): AppTheme {
  return resolveTheme(readPreference())
}

export function applyTheme(resolved: AppTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  window.dispatchEvent(new CustomEvent('qrp-theme-changed', { detail: { theme: resolved } }))
}

export function setPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(KEY, preference)
  } catch {
    /* ignore */
  }
  applyTheme(resolveTheme(preference))
}

/** Persist and apply a resolved theme (not system). */
export function setTheme(theme: AppTheme) {
  setPreference(theme)
}

export function initTheme() {
  applyTheme(resolveTheme(readPreference()))
}

export function nextPreference(current: ThemePreference): ThemePreference {
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'system'
  return 'light'
}

if (import.meta.env?.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('theme-selfcheck')) {
  console.assert(nextPreference('light') === 'dark')
  console.assert(nextPreference('dark') === 'system')
  console.assert(nextPreference('system') === 'light')
  console.assert(resolveTheme('light') === 'light')
  console.assert(resolveTheme('dark') === 'dark')
}
