import { cn } from '@/lib/utils'

/**
 * Soft orb backdrop — used when WebGL CubeWave is off / failed / a11y pause.
 * No CSS cube grid (that perspective+scaleY fake wave looked broken).
 */
export function ThemeWaveFallback({ className }: { className?: string }) {
  return (
    <div className={cn('theme-wave-fallback pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="theme-wave-fallback__orb theme-wave-fallback__orb--a" />
      <div className="theme-wave-fallback__orb theme-wave-fallback__orb--b" />
    </div>
  )
}
