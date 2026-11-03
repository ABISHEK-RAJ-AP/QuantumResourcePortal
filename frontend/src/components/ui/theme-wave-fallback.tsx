import { cn } from '@/lib/utils'

/** Small grid — transform-only wave (see index.css). Was 12×8 + filter anim = janky on Chrome/Edge. */
const COLS = 8
const ROWS = 5
const CELLS = COLS * ROWS

/**
 * CSS cube-wave stand-in for the landing hero.
 * Radial delay mimics CubeWave crest without WebGL or per-frame filters.
 */
export function ThemeWaveFallback({ className }: { className?: string }) {
  return (
    <div className={cn('theme-wave-fallback pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="theme-wave-fallback__orb theme-wave-fallback__orb--a" />
      <div className="theme-wave-fallback__orb theme-wave-fallback__orb--b" />
      <div
        className="theme-wave-fallback__cubes"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: CELLS }).map((_, i) => {
          const x = i % COLS
          const z = Math.floor(i / COLS)
          const dx = x - (COLS - 1) / 2
          const dz = z - (ROWS - 1) / 2
          const d = Math.sqrt(dx * dx + dz * dz)
          return <span key={i} style={{ animationDelay: `${(d * 0.14).toFixed(2)}s` }} />
        })}
      </div>
    </div>
  )
}
