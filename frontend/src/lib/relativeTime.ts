export function relativeTime(value: string | Date | undefined | null) {
  if (!value) return ''
  const then = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(then.getTime())) return ''
  const delta = Date.now() - then.getTime()
  const min = Math.round(Math.abs(delta) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 36) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}