import { useSyncExternalStore } from 'react'

import { ThemeWaveFallback } from '@/components/ui/theme-wave-fallback'
import { cn } from '@/lib/utils'

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
 * Full-bleed hero uses CSS cube-wave only.
 * WebGL CubeWave was slow on Chrome and blank/failed on Edge — keep R3F offline for this surface.
 * Static gradient when a11y pause / disable-webgl is on.
 */
export function CubeWaveHero({ className }: { className?: string }) {
  const a11yOff = useSyncExternalStore(subscribeDisable, readDisabled, () => false)

  if (a11yOff) {
    return (
      <div
        className={cn('theme-wave-fallback theme-wave-fallback--static pointer-events-none absolute inset-0 z-0', className)}
        aria-hidden
      />
    )
  }

  return <ThemeWaveFallback className={cn('z-0', className)} />
}
