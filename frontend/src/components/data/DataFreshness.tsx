/** Shell header: connection freshness (timestamp only — no demo labels). */
export function DataFreshness({ updatedAt }: { updatedAt?: number }) {
  if (!updatedAt) return null
  const d = new Date(updatedAt)
  return (
    <div className="qrp-page-head__freshness text-xs text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground">Connected</span>
      {' · '}
      Last updated{' '}
      {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  )
}