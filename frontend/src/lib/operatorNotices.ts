const STORAGE_KEY = 'qrp_operator_notices_v1'
export const OPERATOR_NOTICES_EVENT = 'qrp:operator-notices'

export type OperatorNotice = {
  id: string
  title: string
  body: string
  variant?: 'info' | 'warn' | 'critical' | 'error'
  href?: string
  createdAt?: number
  updatedAt?: number
  state?: 'active' | 'dismissed'
  seen?: boolean
  snoozeUntil?: number | null
}

function emit() {
  window.dispatchEvent(new CustomEvent(OPERATOR_NOTICES_EVENT))
}

function readRaw(): OperatorNotice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as OperatorNotice[]) : []
  } catch {
    return []
  }
}

function write(list: OperatorNotice[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* ignore */
  }
  emit()
}

export function getActiveOperatorNotices(now = Date.now()) {
  return readRaw().filter((n) => n.state !== 'dismissed' && (!n.snoozeUntil || n.snoozeUntil <= now))
}

export function unreadOperatorNoticeCount(now = Date.now()) {
  return getActiveOperatorNotices(now).filter((n) => !n.seen).length
}

export function upsertOperatorNotice(notice: Partial<OperatorNotice> & { id: string }) {
  const now = Date.now()
  const list = readRaw()
  const idx = list.findIndex((n) => n.id === notice.id)
  const next: OperatorNotice = {
    id: notice.id,
    title: notice.title || 'Notice',
    body: notice.body || '',
    variant: notice.variant || 'info',
    href: notice.href,
    createdAt: notice.createdAt ?? now,
    updatedAt: now,
    state: 'active',
    seen: false,
    snoozeUntil: notice.snoozeUntil ?? null,
  }
  if (idx >= 0) {
    const prev = list[idx]
    const bodyChanged = (prev.body || '') !== (next.body || '')
    list[idx] = {
      ...prev,
      ...next,
      createdAt: prev.createdAt ?? now,
      seen: bodyChanged ? false : prev.seen,
      state: 'active',
    }
  } else {
    list.unshift(next)
  }
  write(list)
  return next
}

export function markOperatorNoticesSeen() {
  const list = readRaw().map((n) => (n.state === 'dismissed' ? n : { ...n, seen: true }))
  write(list)
}

export function dismissOperatorNotice(id: string) {
  write(readRaw().map((n) => (n.id === id ? { ...n, state: 'dismissed' as const } : n)))
}

export function remindOperatorNoticeLater(id: string, ms = 30 * 60_000) {
  const until = Date.now() + ms
  write(readRaw().map((n) => (n.id === id ? { ...n, snoozeUntil: until, seen: true } : n)))
}

export function clearDismissedOperatorNotices() {
  write(readRaw().filter((n) => n.state !== 'dismissed'))
}

/** Sync lab `/notifications` into the local notice tray. */
export function syncLabNotifications(
  rows: { id?: string; title?: string; body?: string; tone?: string; href?: string; read?: boolean }[],
) {
  for (const row of rows) {
    if (!row.id) continue
    const variant =
      row.tone === 'critical' ? 'critical' : row.tone === 'warning' ? 'warn' : ('info' as const)
    const list = readRaw()
    const existing = list.find((n) => n.id === row.id)
    if (existing && existing.state === 'dismissed') continue
    upsertOperatorNotice({
      id: row.id,
      title: row.title || 'Notice',
      body: row.body || '',
      variant,
      href: row.href,
      seen: Boolean(row.read),
    })
  }
}
