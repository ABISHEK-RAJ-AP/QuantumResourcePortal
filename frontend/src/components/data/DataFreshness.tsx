/** Show when a react-query result last refreshed. */
export function DataFreshness({ updatedAt }: { updatedAt?: number }) {
  if (!updatedAt) return null
  const d = new Date(updatedAt)
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Updated {d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </p>
  )
}
