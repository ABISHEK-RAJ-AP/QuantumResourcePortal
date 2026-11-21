export function formatQueueWait(row: Record<string, unknown>) {
  const wait = row.estimated_wait_time
  if (wait == null || wait === '') return 'Unavailable'
  const n = Number(wait)
  if (!Number.isFinite(n)) return 'Unavailable'
  if (n >= 3600) return `${(n / 3600).toFixed(1)} h (est.)`
  if (n >= 60) return `${Math.round(n / 60)} min (est.)`
  return `${Math.round(n)} s (est.)`
}
