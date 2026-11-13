import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bell, CheckCheck, Clock, X } from 'lucide-react'
import { useNavigate } from 'react-router'

import { asList, qre } from '@/api/qre'
import {
  OPERATOR_NOTICES_EVENT,
  clearDismissedOperatorNotices,
  dismissOperatorNotice,
  getActiveOperatorNotices,
  markOperatorNoticesSeen,
  remindOperatorNoticeLater,
  syncLabNotifications,
  unreadOperatorNoticeCount,
  type OperatorNotice,
} from '@/lib/operatorNotices'
import { notifyError, notifyWarn } from '@/lib/toast'
import { cn } from '@/lib/utils'

function noticeIcon(notice: OperatorNotice) {
  if (notice.variant === 'critical' || notice.variant === 'error') return AlertTriangle
  if (notice.variant === 'warn') return Clock
  return Bell
}

function toneClass(variant?: string) {
  if (variant === 'critical' || variant === 'error') return 'border-critical/30 bg-critical-soft/40'
  if (variant === 'warn') return 'border-warning/30 bg-warning-soft/40'
  return 'border-border bg-muted/40'
}

export function OperatorNoticeBell({ className }: { className?: string }) {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [notices, setNotices] = useState(() => getActiveOperatorNotices())
  const [unread, setUnread] = useState(() => unreadOperatorNoticeCount())

  const remote = useQuery({
    queryKey: ['lab-notifications'],
    queryFn: async () => asList(await qre<unknown>('/notifications')),
    retry: false,
    refetchInterval: 60_000,
  })

  const refresh = useCallback(() => {
    setNotices(getActiveOperatorNotices())
    setUnread(unreadOperatorNoticeCount())
  }, [])

  useEffect(() => {
    if (!remote.data) return
    const rows = remote.data.map((r) => ({
      id: String(r.id || ''),
      title: String(r.title || ''),
      body: String(r.body || ''),
      tone: String(r.tone || ''),
      href: r.href ? String(r.href) : undefined,
      read: Boolean(r.read),
    }))
    syncLabNotifications(rows)
    for (const row of rows) {
      if (row.read || !row.id) continue
      const msg = `${row.title}: ${row.body}`
      if (row.tone === 'critical') notifyError(msg, { toastId: `n:${row.id}` })
      else if (row.tone === 'warning') notifyWarn(msg, { toastId: `n:${row.id}` })
    }
    refresh()
  }, [remote.data, refresh])

  useEffect(() => {
    refresh()
    const onEvt = () => refresh()
    window.addEventListener(OPERATOR_NOTICES_EVENT, onEvt)
    return () => window.removeEventListener(OPERATOR_NOTICES_EVENT, onEvt)
  }, [refresh])

  useEffect(() => {
    if (!open) return undefined
    markOperatorNoticesSeen()
    refresh()
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, refresh])

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        type="button"
        className="relative grid size-9 min-h-9 min-w-9 place-items-center rounded-lg border border-input hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute top-1 end-1 grid min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute end-0 top-[calc(100%+8px)] z-50 flex max-h-[min(72vh,520px)] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          role="dialog"
          aria-label="Operator notifications"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Bell className="size-4" aria-hidden />
              Notifications
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => {
                clearDismissedOperatorNotices()
                refresh()
              }}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Clear done
            </button>
          </header>
          <ul className="flex flex-1 flex-col gap-2 overflow-auto p-2.5">
            {notices.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No active notices</li>
            ) : (
              notices.map((n) => {
                const Icon = noticeIcon(n)
                return (
                  <li key={n.id} className={cn('rounded-lg border p-3', toneClass(n.variant))}>
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {n.href ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => {
                                setOpen(false)
                                navigate(n.href!)
                              }}
                            >
                              Open
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => {
                              remindOperatorNoticeLater(n.id)
                              refresh()
                            }}
                          >
                            Later
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:underline"
                            onClick={() => {
                              dismissOperatorNotice(n.id)
                              refresh()
                            }}
                          >
                            <X className="size-3" aria-hidden />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
