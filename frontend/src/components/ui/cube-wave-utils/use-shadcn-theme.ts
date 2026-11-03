import { useEffect, useState } from 'react'
import * as THREE from 'three'

import { useTheme } from '@/components/theme/ThemeProvider'

export type ThemeMode = 'auto' | 'light' | 'dark'

function readCssColor(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Maps shadcn CSS variables into Three.js colors; re-reads when app theme changes. */
export function useShadcnTheme(_theme: ThemeMode = 'auto') {
  const { theme } = useTheme()
  const [colors, setColors] = useState(() => ({
    primaryColor: new THREE.Color(readCssColor('--brand-primary', '#536dfe')),
    accentColor: new THREE.Color(readCssColor('--brand-cyan', '#20b8d5')),
  }))

  useEffect(() => {
    // Wait a frame so `.dark` token swap is painted.
    const id = window.requestAnimationFrame(() => {
      setColors({
        primaryColor: new THREE.Color(
          readCssColor('--brand-primary', theme === 'dark' ? '#7b8cff' : '#536dfe'),
        ),
        accentColor: new THREE.Color(
          readCssColor('--brand-cyan', theme === 'dark' ? '#3ad0ea' : '#20b8d5'),
        ),
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [theme])

  return colors
}
