import { lazy, Suspense, useSyncExternalStore } from 'react'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ThemeWaveFallback } from '@/components/ui/theme-wave-fallback'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const CubeWave = lazy(() => import('@/components/ui/cube-wave'))

function subscribeDisable(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-disable-webgl', 'class'] })
  window.addEventListener('qrp-a11y-changed', cb)
  return () => {
    obs.disconnect()
    window.removeEventListener('qrp-a11y-changed', cb)
  }
}

function readDisabled() {
  return (
    document.body.dataset.disableWebgl === '1' ||
    document.body.classList.contains('a11y-pause-anim')
  )
}

/**
 * Original TeleScope / Cert Studio hero: WebGL CubeWave.
 * Soft orbs only when a11y pause, WebGL disabled, or R3F fails.
 */
export function CubeWaveHero({ className }: { className?: string }) {
  const a11yOff = useSyncExternalStore(subscribeDisable, readDisabled, () => false)
  const { theme } = useTheme()
  const mode = theme === 'dark' ? 'dark' : 'light'

  const fallback = <ThemeWaveFallback className={cn('z-0', className)} />

  if (a11yOff) return fallback

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <div className={cn('pointer-events-none absolute inset-0 z-0', className)} aria-hidden>
          <ThemeWaveFallback />
          <CubeWave className="absolute inset-0 h-full w-full" theme={mode} grid={14} gap={0.78} speed={0.85} />
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}
