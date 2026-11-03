import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarClock,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Plus,
  ScrollText,
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

/**
 * Cert Studio–style bottom-right quick actions.
 * Keeps random CTAs out of page headers; one dock for role work.
 */
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
      setSeedMsg(`Demo: ${r.projects}p · ${r.approvals}r · ${r.reservations}h`)
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
        label: 'Review next request',
        subtitle: queue ? `${queue} in queue` : 'Open review queue',
        to: '/qrp/approvals',
        badge: queue || undefined,
        tone: queue ? 'warning' : 'primary',
        icon: <ClipboardList className="size-5" strokeWidth={2} />,
      },
      {
        id: 'request',
        label: 'Create resource request',
        subtitle: 'From a project',
        to: '/qrp/projects',
        icon: <Plus className="size-5" strokeWidth={2} />,
      },
      {
        id: 'ops',
        label: 'Operations Centre',
        subtitle: 'Exceptions & posture',
        to: '/qrp/centre',
        icon: <Gauge className="size-5" strokeWidth={2} />,
      },
      {
        id: 'incidents',
        label: 'Incidents',
        subtitle: incidents ? `${incidents} open` : 'Triage cases',
        to: '/qrp/incidents',
        badge: incidents || undefined,
        tone: incidents ? 'critical' : 'primary',
        icon: <Siren className="size-5" strokeWidth={2} />,
      },
      {
        id: 'alerts',
        label: 'Alert queue',
        subtitle: alerts ? `${alerts} active` : 'Fleet signals',
        to: '/qrp/support',
        badge: alerts > 0 ? Math.min(alerts, 99) : undefined,
        tone: alerts ? 'warning' : 'primary',
        icon: <Zap className="size-5" strokeWidth={2} />,
      },
      {
        id: 'reconcile',
        label: 'Reconciliation',
        subtitle: unresolved ? `${unresolved} unresolved` : 'Dispatch outcomes',
        to: '/qrp/reconciliation',
        badge: unresolved || undefined,
        tone: unresolved ? 'critical' : 'primary',
        icon: <LayoutDashboard className="size-5" strokeWidth={2} />,
      },
      {
        id: 'hold',
        label: 'Schedule hold',
        subtitle: 'Governance reservation window',
        to: '/qrp/scheduling',
        icon: <CalendarClock className="size-5" strokeWidth={2} />,
      },
      {
        id: 'quotas',
        label: 'Quotas & usage',
        subtitle: 'Daily shot ledger',
        to: '/qrp/quotas',
        icon: <ScrollText className="size-5" strokeWidth={2} />,
      },
    ]
    if (isAdmin) {
      list.push({
        id: 'demo',
        label: seed.isPending ? 'Loading demo…' : 'Load demo workspace',
        subtitle: 'Seed via real APIs',
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
          <div className="qrp-quick-dock__panel-head">
            <span>Quick actions</span>
            <button type="button" className="btn-ghost p-1" aria-label="Close quick actions" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </button>
          </div>
          <ul className="qrp-quick-dock__list">
            {actions.map((a) => {
              const body = (
                <>
                  <span className={cn('qrp-quick-dock__icon', a.tone === 'critical' && 'is-critical', a.tone === 'warning' && 'is-warning')}>
                    {a.icon}
                  </span>
                  <span className="qrp-quick-dock__copy">
                    <span className="qrp-quick-dock__label">{a.label}</span>
                    <span className="qrp-quick-dock__sub">{a.subtitle}</span>
                  </span>
                  {a.badge ? <span className="qrp-quick-dock__badge">{a.badge}</span> : null}
                </>
              )
              return (
                <li key={a.id}>
                  {a.to ? (
                    <Link
                      role="menuitem"
                      className="qrp-quick-dock__action"
                      to={a.to}
                      onClick={() => setOpen(false)}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="qrp-quick-dock__action"
                      disabled={a.id === 'demo' && seed.isPending}
                      onClick={() => a.onClick?.()}
                    >
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
        className={cn('qrp-quick-dock__toggle', urgent > 0 && 'has-urgent')}
        aria-expanded={open}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Zap className="size-5" />}
        {urgent > 0 && !open ? <span className="qrp-quick-dock__fab-badge">{urgent > 99 ? '99+' : urgent}</span> : null}
      </button>
    </div>
  )
}
