import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { applyTheme, initTheme, readTheme, setTheme as persistTheme, type AppTheme } from '@/lib/theme'
import { initA11yFromStorage } from '@/lib/a11y'

type ThemeApi = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light'
    initTheme()
    initA11yFromStorage()
    return readTheme()
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'qrp_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeApi>(
    () => ({
      theme,
      setTheme: (next) => {
        persistTheme(next)
        setThemeState(next)
      },
      toggleTheme: () => {
        const next = theme === 'light' ? 'dark' : 'light'
        persistTheme(next)
        setThemeState(next)
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme requires ThemeProvider')
  return ctx
}
