/** Persisted operator notices (Q-TeleScope / Govern pattern). */

const STORAGE_KEY = 'qrp_govern_notices_v1'
const TOAST_GATE_KEY = 'qrp_govern_toast_gate_v1'
export const GOVERN_NOTICES_EVENT = 'govern:notices'

export type GovernNoticeVariant = 'info' | 'warn' | 'error'
export type GovernNoticeTone = 'ok' | 'warn' | 'err'

export type GovernNoticeAction = {
  label: string
  href?: string
  dismiss?: boolean
  onClick?: () => void
}

export type GovernNotice = {
  id: string
  title: string
  body: string
  variant: GovernNoticeVariant
  tone: GovernNoticeTone
  app: string
  source: string
  actions: GovernNoticeAction[]
  createdAt: number
  updatedAt: number
  state: 'active' | 'dismissed'
  seen: boolean
  snoozeUntil: number | null
}

function readToastGate(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(TOAST_GATE_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeToastGate(gate: Record<string, string>) {
  try {
    sessionStorage.setItem(TOAST_GATE_KEY, JSON.stringify(gate))
  } catch {
    /* ignore */
  }
}

export function shouldShowGovernToast(id: string, body: string) {
  if (!id) return true
  const gate = readToastGate()
  return gate[id] !== String(body || '').trim()
}

export function markGovernToastShown(id: string, body: string) {
  if (!id) return
  const gate = readToastGate()
  gate[id] = String(body || '').trim()
  writeToastGate(gate)
}

export function clearGovernToastGate(id: string) {
  if (!id) return
  const gate = readToastGate()
  delete gate[id]
  writeToastGate(gate)
}

function emit() {
  window.dispatchEvent(new CustomEvent(GOVERN_NOTICES_EVENT))
}

function readRaw(): GovernNotice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as GovernNotice[]) : []
  } catch {
    return []
  }
}

function write(list: GovernNotice[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 60)))
  } catch {
    /* ignore */
  }
  emit()
}

function toneToVariant(tone?: string): GovernNoticeVariant {
  if (tone === 'err' || tone === 'error' || tone === 'critical') return 'error'
  if (tone === 'warn') return 'warn'
  return 'info'
}

export function getActiveGovernNotices(now = Date.now()) {
  return readRaw().filter((n) => n.state !== 'dismissed' && (!n.snoozeUntil || n.snoozeUntil <= now))
}

export function unreadGovernNoticeCount(now = Date.now()) {
  return getActiveGovernNotices(now).filter((n) => !n.seen).length
}

export function upsertGovernNotice(notice: Partial<GovernNotice> & { id: string }) {
  const id = notice.id
  if (!id) return null
  const now = Date.now()
  const list = readRaw()
  const idx = list.findIndex((n) => n.id === id)
  const variant = notice.variant || toneToVariant(notice.tone)
  const next: GovernNotice = {
    id,
    title: notice.title || 'Notice',
    body: notice.body || '',
    variant,
    tone:
      notice.tone
      || (variant === 'error' ? 'err' : variant === 'warn' ? 'warn' : 'ok'),
    app: notice.app || 'QRP',
    source: notice.source || 'local',
    actions: notice.actions || [],
    createdAt: notice.createdAt ?? now,
    updatedAt: now,
    state: 'active',
    seen: false,
    snoozeUntil: notice.snoozeUntil ?? null,
  }
  if (idx >= 0) {
    const prev = list[idx]!
    const bodyChanged = (prev.body || '') !== (next.body || '')
    list[idx] = {
      ...prev,
      ...next,
      seen: bodyChanged ? false : prev.seen,
      state: prev.state === 'dismissed' && !bodyChanged ? 'dismissed' : 'active',
      createdAt: prev.createdAt ?? next.createdAt,
    }
  } else {
    list.unshift(next)
  }
  write(list)
  return next
}

export function removeGovernNotice(id: string) {
  write(readRaw().filter((n) => n.id !== id))
}

export function reconcileGovernServerNotices(keepIds: Set<string>) {
  const prefix = 'govern:server:'
  write(readRaw().filter((n) => !String(n.id).startsWith(prefix) || keepIds.has(n.id)))
}

export function markGovernNoticesSeen() {
  write(readRaw().map((n) => ({ ...n, seen: true })))
}

export function dismissGovernNotice(id: string) {
  clearGovernToastGate(id)
  write(readRaw().map((n) => (n.id === id ? { ...n, state: 'dismissed', seen: true } : n)))
}

export function snoozeGovernNotice(id: string, untilMs: number) {
  write(readRaw().map((n) => (n.id === id ? { ...n, snoozeUntil: untilMs, seen: true } : n)))
}

export function clearDismissedGovernNotices() {
  write(readRaw().filter((n) => n.state !== 'dismissed'))
}

const DAY_MS = 24 * 60 * 60 * 1000

export function remindGovernNoticeLater(id: string) {
  markGovernToastShown(id, '__snoozed__')
  snoozeGovernNotice(id, Date.now() + DAY_MS)
}

export function dismissAllActiveGovernNotices() {
  const active = new Set(getActiveGovernNotices().map((n) => n.id))
  write(readRaw().map((n) => (active.has(n.id) ? { ...n, state: 'dismissed', seen: true } : n)))
}