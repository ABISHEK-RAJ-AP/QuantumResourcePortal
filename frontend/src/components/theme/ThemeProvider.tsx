import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  applyTheme,
  initTheme,
  nextPreference,
  readPreference,
  resolveTheme,
  setPreference as persistPreference,
  type AppTheme,
  type ThemePreference,
} from '@/lib/theme'
import { initA11yFromStorage } from '@/lib/a11y'

type ThemeApi = {
  /** Stored choice: light, dark, or follow the OS. */
  preference: ThemePreference
  /** Resolved light/dark currently on the document. */
  theme: AppTheme
  setTheme: (preference: ThemePreference) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'light'
    initTheme()
    initA11yFromStorage()
    return readPreference()
  })
  const [theme, setThemeState] = useState<AppTheme>(() =>
    typeof window === 'undefined' ? 'light' : resolveTheme(readPreference()),
  )

  useEffect(() => {
    const resolved = resolveTheme(preference)
    applyTheme(resolved)
    setThemeState(resolved)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = getFreshSystem()
      applyTheme(resolved)
      setThemeState(resolved)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'qrp_theme') return
      if (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system') {
        setPreferenceState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeApi>(
    () => ({
      preference,
      theme,
      setTheme: (next) => {
        persistPreference(next)
        setPreferenceState(next)
      },
      toggleTheme: () => {
        const next = nextPreference(preference)
        persistPreference(next)
        setPreferenceState(next)
      },
    }),
    [preference, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function getFreshSystem(): AppTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme requires ThemeProvider')
  return ctx
}
