import {
  markGovernToastShown,
  shouldShowGovernToast,
  upsertGovernNotice,
  type GovernNoticeAction,
  type GovernNoticeTone,
} from '@/lib/governNotices'

const listeners: Array<(item: ToastLiveItem) => void> = []
let seq = 0

const TITLES: Record<GovernNoticeTone, string> = {
  ok: 'Completed',
  err: 'Action required',
  warn: 'Attention',
}

export type ToastLiveItem = {
  id: string
  message: string
  title: string
  app: string
  tone: GovernNoticeTone
  at: string
}

export type ToastMeta = {
  id?: string
  title?: string
  app?: string
  showToast?: boolean
  persist?: boolean
  actions?: GovernNoticeAction[]
}

export function toast(message: string, tone: GovernNoticeTone | 'error' = 'ok', meta: ToastMeta = {}) {
  const text = String(message || '').trim()
  if (!text) return
  const normalized: GovernNoticeTone =
  tone === 'err' || tone === 'error' ? 'err' : tone === 'warn' ? 'warn' : 'ok'
  const id = meta.id || `govern:toast:${++seq}`
  const item: ToastLiveItem = {
    id,
    message: text,
    title: meta.title || TITLES[normalized],
    app: meta.app || 'QRP',
    tone: normalized,
    at: new Date().toISOString(),
  }

  if (meta.persist !== false) {
    upsertGovernNotice({
      id,
      title: item.title,
      body: text,
      tone: normalized,
      app: item.app,
      source: 'toast',
      actions: meta.actions || [],
    })
  }

  if (meta.showToast === false) return
  if (!shouldShowGovernToast(id, text)) return
  markGovernToastShown(id, text)
  listeners.forEach((fn) => fn(item))
}

export function subscribeToasts(fn: (item: ToastLiveItem) => void) {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export function inferNoticeTone(notice: string): GovernNoticeTone {
  const t = String(notice || '').toLowerCase()
  if (!t) return 'ok'
  if (/fail|denied|error|invalid|not found|required|unable|cannot|conflict/.test(t)) return 'err'
  if (/warn|caution|stale|pending/.test(t)) return 'warn'
  return 'ok'
}