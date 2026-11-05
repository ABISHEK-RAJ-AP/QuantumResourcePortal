import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Plus,
  Siren,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { seedPortalDemo } from '@/api/seedDemo'
import { asList, qre } from '@/api/qre'
import { getSessionUser } from '@/lib/session'
import { cn } from '@/lib/utils'

type DockAction = {
  id: string
  label: string
  subtitle: string
  to?: string
  onClick?: () => void
  badge?: number
  tone?: 'primary' | 'warning' | 'critical'
  icon: React.ReactNode
}

/** Lifecycle actions only — not a second sidebar. */
export function QrpQuickActionDock() {
  const client = useQueryClient()
  const user = getSessionUser()
  const [open, setOpen] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<{ queue?: number }>('/governance/summary'),
    retry: false,
  })
  const reconcile = useQuery({
    queryKey: ['nav-reconcile-count'],
    queryFn: async () => {
      const rows = asList(await qre<unknown>('/dispatch-attempts'))
      return rows.filter((r) => {
        const s = String(r.dispatch_state || '')
        return s === 'dispatch_unresolved' || s === 'dispatch_authorized'
      }).length
    },
    retry: false,
  })
  const centre = useQuery({
    queryKey: ['operations-centre-nav'],
    queryFn: () => qre<{ operations?: { open_incidents?: number; active_alerts?: number } }>('/operations/centre'),
    retry: false,
  })

  const seed = useMutation({
    mutationFn: seedPortalDemo,
    onSuccess: (r) => {
      setSeedMsg(`Demo: ${r.projects}p · ${r.approvals}r · ${r.reservations}h · ${r.assets}a`)
      void client.invalidateQueries()
      setOpen(false)
    },
    onError: (e) => setSeedMsg(e instanceof Error ? e.message : 'Seed failed'),
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const queue = summary.isError ? 0 : Number(summary.data?.queue ?? 0)
  const incidents = centre.isError ? 0 : Number(centre.data?.operations?.open_incidents ?? 0)
  const alerts = centre.isError ? 0 : Number(centre.data?.operations?.active_alerts ?? 0)
  const unresolved = reconcile.isError ? 0 : Number(reconcile.data ?? 0)
  const role = (user?.role || '').toLowerCase()
  const isAdmin = role.includes('admin')

  const actions = useMemo((): DockAction[] => {
    const list: DockAction[] = [
      {
        id: 'review',
        label: 'Review queue',
        subtitle: queue ? `${queue} waiting` : 'Open queue',
        to: '/qrp/approvals',
        badge: queue || undefined,
        tone: queue ? 'warning' : 'primary',
        icon: <ClipboardList className="size-5" strokeWidth={2} />,
      },
      {
        id: 'project',
        label: 'Projects',
        subtitle: 'Submit requests',
        to: '/qrp/projects',
        icon: <Plus className="size-5" strokeWidth={2} />,
      },
      {
        id: 'hold',
        label: 'Schedule hold',
        subtitle: 'After approval',
        to: '/qrp/scheduling',
        icon: <CalendarClock className="size-5" strokeWidth={2} />,
      },
      {
        id: 'reconcile',
        label: 'Reconciliation',
        subtitle: unresolved ? `${unresolved} open` : 'Dispatch outcomes',
        to: '/qrp/reconciliation',
        badge: unresolved || undefined,
        tone: unresolved ? 'critical' : 'primary',
        icon: <LayoutDashboard className="size-5" strokeWidth={2} />,
      },
      {
        id: 'incidents',
        label: 'Incidents',
        subtitle: incidents ? `${incidents} open` : 'Cases',
        to: '/qrp/incidents',
        badge: incidents || undefined,
        tone: incidents ? 'critical' : 'primary',
        icon: <Siren className="size-5" strokeWidth={2} />,
      },
      {
        id: 'alerts',
        label: 'Alerts',
        subtitle: alerts ? `${alerts} active` : 'Fleet signals',
        to: '/qrp/support',
        badge: alerts > 0 ? Math.min(alerts, 99) : undefined,
        tone: alerts ? 'warning' : 'primary',
        icon: <Zap className="size-5" strokeWidth={2} />,
      },
    ]
    if (isAdmin) {
      list.push({
        id: 'demo',
        label: seed.isPending ? 'Loading demo…' : 'Load demo',
        subtitle: 'Seed via APIs',
        onClick: () => seed.mutate(),
        icon: <Sparkles className="size-5" strokeWidth={2} />,
      })
    }
    return list
  }, [queue, incidents, alerts, unresolved, isAdmin, seed.isPending])

  const urgent = queue + incidents + unresolved

  return (
    <div ref={rootRef} className="qrp-quick-dock-root" aria-label="Quick actions">
      {seedMsg ? (
        <p className="qrp-quick-dock__toast" role="status">
          {seedMsg}
          <button type="button" className="ms-2 underline" onClick={() => setSeedMsg(null)}>
            dismiss
          </button>
        </p>
      ) : null}
      {open ? (
        <div className="qrp-quick-dock__panel" role="menu">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Actions</p>
            <button type="button" className="btn-ghost grid size-7 place-items-center p-0" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="size-3.5" />
            </button>
          </div>
          <ul className="space-y-1">
            {actions.map((action) => {
              const body = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">{action.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{action.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{action.subtitle}</span>
                  </span>
                  {action.badge ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                        action.tone === 'critical' && 'bg-critical-soft text-critical',
                        action.tone === 'warning' && 'bg-warning-soft text-warning',
                        (!action.tone || action.tone === 'primary') && 'bg-primary/15 text-primary',
                      )}
                    >
                      {action.badge}
                    </span>
                  ) : null}
                </>
              )
              return (
                <li key={action.id}>
                  {action.to ? (
                    <Link className="qrp-quick-dock__item" to={action.to} role="menuitem" onClick={() => setOpen(false)}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" className="qrp-quick-dock__item w-full text-start" role="menuitem" onClick={action.onClick}>
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className={cn('qrp-quick-dock__fab', urgent > 0 && 'qrp-quick-dock__fab--urgent')}
        aria-expanded={open}
        aria-label="Quick actions"
        onClick={() => setOpen((v) => !v)}
      >
        <Zap className="size-5" strokeWidth={2} />
        {urgent > 0 ? <span className="qrp-quick-dock__fab-badge">{urgent > 99 ? '99+' : urgent}</span> : null}
      </button>
    </div>
  )
}
