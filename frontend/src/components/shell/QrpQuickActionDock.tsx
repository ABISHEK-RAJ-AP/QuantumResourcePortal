import { useMemo, useRef, useState } from 'react'
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

import { startDemoSimulation } from '@/api/demoSimulation'
import { seedPortalDemo } from '@/api/seedDemo'
import { asList, qre } from '@/api/qre'
import { useAuth } from '@/auth/hooks'
import { cn } from '@/lib/utils'

import { demoActionsAllowed } from '@/lib/demo'

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

function formatBadge(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n > 99) return '99+'
  return String(n)
}

/** Lifecycle shortcuts — collapsed by default (TeleScope dock pattern). */
export function QrpQuickActionDock() {
  const client = useQueryClient()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
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
    mutationFn: async () => {
      const r = await seedPortalDemo({ force: true })
      if (r.source === 'backend') {
        try {
          await startDemoSimulation(1)
        } catch {
          /* optional */
        }
      }
      return r
    },
    onSuccess: (r) => {
      const src = r.source === 'backend' ? 'DB' : 'API'
      setSeedMsg(`Demo (${src}): ${r.projects}p · ${r.approvals}w · ${r.reservations}r · ${r.members}u · sim on`)
      void client.invalidateQueries()
      setExpanded(false)
    },
    onError: (e) => setSeedMsg(e instanceof Error ? e.message : 'Seed failed'),
  })

  const queue = summary.isError ? 0 : Number(summary.data?.queue ?? 0)
  const incidents = centre.isError ? 0 : Number(centre.data?.operations?.open_incidents ?? 0)
  const alerts = centre.isError ? 0 : Number(centre.data?.operations?.active_alerts ?? 0)
  const unresolved = reconcile.isError ? 0 : Number(reconcile.data ?? 0)
  const role = (user?.roles?.[0] || '').toLowerCase()
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
    if (isAdmin && demoActionsAllowed) {
      list.push({
        id: 'demo',
        label: seed.isPending ? 'Loading demo…' : 'Load demo',
        subtitle: 'PostgreSQL seed',
        onClick: () => seed.mutate(),
        icon: <Sparkles className="size-5" strokeWidth={2} />,
      })
    }
    return list
  }, [queue, incidents, alerts, unresolved, isAdmin, seed.isPending])

  const urgent = queue + incidents + unresolved
  const showActions = expanded

  const closeAfter = () => {
    setExpanded(false)
  }

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

      <div className={cn('qrp-quick-dock', showActions && 'qrp-quick-dock--expanded')}>
        <div
          className={cn('qrp-quick-dock__actions', showActions && 'qrp-quick-dock__actions--open')}
          aria-hidden={!showActions}
        >
          {actions.map((action) => {
            const inner = (
              <>
                <span
                  className={cn(
                    'qrp-quick-dock__icon',
                    action.tone === 'warning' && 'is-warning',
                    action.tone === 'critical' && 'is-critical',
                  )}
                >
                  {action.icon}
                  {action.badge ? (
                    <span className="qrp-quick-dock__badge" aria-hidden>
                      {formatBadge(action.badge)}
                    </span>
                  ) : null}
                </span>
                <span className="qrp-quick-dock__copy">
                  <span className="qrp-quick-dock__label">{action.label}</span>
                  {action.subtitle ? <span className="qrp-quick-dock__sub">{action.subtitle}</span> : null}
                </span>
              </>
            )
            if (action.to) {
              return (
                <Link
                  key={action.id}
                  className="qrp-quick-dock__action"
                  to={action.to}
                  onClick={closeAfter}
                >
                  {inner}
                </Link>
              )
            }
            return (
              <button
                key={action.id}
                type="button"
                className="qrp-quick-dock__action"
                onClick={() => {
                  action.onClick?.()
                  if (action.id !== 'demo') closeAfter()
                }}
              >
                {inner}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className={cn('qrp-quick-dock__toggle', urgent > 0 && !showActions && 'has-urgent')}
          aria-expanded={showActions}
          aria-label={urgent > 0 ? `Quick actions, ${urgent} items need attention` : 'Quick actions'}
          onClick={() => setExpanded((v) => !v)}
        >
          {!showActions && urgent > 0 ? (
            <span className="qrp-quick-dock__fab-badge">{formatBadge(urgent)}</span>
          ) : null}
          {showActions ? <X className="size-5" strokeWidth={2} /> : <Zap className="size-5" strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}