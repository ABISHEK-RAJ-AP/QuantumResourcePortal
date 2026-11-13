import { useEffect, useState } from 'react'

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always', style: 'narrow' })

/** Compact age for the shell freshness line (e.g. "2m ago"). */
function formatRelativeAge(updatedAt: number, now: number): string {
  const deltaSec = Math.round((updatedAt - now) / 1000)
  const abs = Math.abs(deltaSec)
  if (abs < 60) return rtf.format(deltaSec, 'second')
  const deltaMin = Math.round(deltaSec / 60)
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, 'minute')
  const deltaHr = Math.round(deltaSec / 3600)
  if (Math.abs(deltaHr) < 48) return rtf.format(deltaHr, 'hour')
  return rtf.format(Math.round(deltaSec / 86400), 'day')
}

/** Show when a react-query result last refreshed. */
export function DataFreshness({ updatedAt }: { updatedAt?: number }) {
  const [now, setNow] = useState(() => Date.now())

  // TanStack Query uses 0 before the first successful fetch — treat as "no time yet".
  const at = updatedAt != null && updatedAt > 0 ? updatedAt : null

  useEffect(() => {
    if (at == null) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [at])

  if (at == null) return null

  const when = new Date(at)
  const absolute = when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const relative = formatRelativeAge(at, now)

  return (
    <p className="text-xs text-muted-foreground tabular-nums" title={absolute}>
      <time dateTime={when.toISOString()} aria-label={`Updated ${absolute}`}>
        Updated {relative}
      </time>
    </p>
  )
}
