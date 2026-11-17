import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import DraggableWidgetGrid from '@/components/ui/draggable-widget-grid'
import type { WidgetSize } from '@/components/ui/draggable-widget-grid-layout'
import { KpiStrip } from '@/components/data/KpiStrip'
import { EmptyState, MetricTile } from '@/components/layout/Page'
import type { WidgetItem } from '@/components/ui/draggable-widget-grid-layout'
import {
  DEFAULT_OVERVIEW_WIDGETS,
  mergeSavedOrder,
  readWidgetLayout,
  writeWidgetLayout,
} from '@/lib/overviewWidgetLayout'
import { formatEnum } from '@/lib/display'

type Row = Record<string, unknown>

function WidgetChrome({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
        {meta}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function OverviewDashboardGrid({
  lens,
  queueCount,
  summaryError,
  myCount,
  unresolvedAttempts,
  openIncidents,
  pendingJobs,
  pipeline,
  recentRows,
  activityRows,
}: {
  lens: string
  queueCount: number
  summaryError: boolean
  myCount: number
  unresolvedAttempts: number
  openIncidents: number
  pendingJobs: number
  pipeline: { label: string; to: string; value: string | number; hot: boolean }[]
  recentRows: Row[]
  activityRows: Row[]
}) {
  const [widgetItems, setWidgetItems] = useState(() =>
    mergeSavedOrder(DEFAULT_OVERVIEW_WIDGETS, readWidgetLayout(lens)),
  )

  useEffect(() => {
    setWidgetItems(mergeSavedOrder(DEFAULT_OVERVIEW_WIDGETS, readWidgetLayout(lens)))
  }, [lens])

  const kpiStrip = useMemo(
    () => (
      <KpiStrip>
        <Link to="/qrp/approvals" className="block rounded-xl border border-border bg-card transition-colors hover:bg-accent">
          <MetricTile compact label="Approvals" value={summaryError ? '—' : queueCount} tone={queueCount > 0 ? 'warning' : 'neutral'} />
        </Link>
        <Link to="/qrp/reconciliation" className="block rounded-xl border border-border bg-card transition-colors hover:bg-accent">
          <MetricTile
            compact
            label="Reconcile"
            value={unresolvedAttempts}
            tone={unresolvedAttempts > 0 ? 'critical' : 'neutral'}
          />
        </Link>
        <Link to="/qrp/jobs" className="block rounded-xl border border-border bg-card transition-colors hover:bg-accent">
          <MetricTile compact label="Pending jobs" value={pendingJobs} tone={pendingJobs > 0 ? 'warning' : 'neutral'} />
        </Link>
        <Link to="/qrp/support" className="block rounded-xl border border-border bg-card transition-colors hover:bg-accent">
          <MetricTile compact label="Incidents" value={openIncidents} tone={openIncidents > 0 ? 'critical' : 'neutral'} />
        </Link>
        <Link to="/qrp/approvals?filter=mine" className="block rounded-xl border border-border bg-card transition-colors hover:bg-accent">
          <MetricTile compact label="My queue" value={myCount} />
        </Link>
      </KpiStrip>
    ),
    [summaryError, queueCount, unresolvedAttempts, pendingJobs, openIncidents, myCount],
  )

  function renderWidget(item: { id: string; size: WidgetSize }) {
    switch (item.id) {
      case 'kpis':
        return <WidgetChrome title="Operational summary">{kpiStrip}</WidgetChrome>
      case 'pipeline':
        return (
          <WidgetChrome title="Lifecycle" meta={<span className="text-xs text-muted-foreground">Click a stage</span>}>
            <LifecyclePipeline pipeline={pipeline} />
          </WidgetChrome>
        )
      case 'actions':
        return (
          <WidgetChrome title="Action centre">
            <nav className="flex flex-col gap-2 text-sm" aria-label="Related workspaces">
              <Link className="font-medium text-primary hover:underline" to="/qrp/approvals">
                Review queue
              </Link>
              <Link className="font-medium text-primary hover:underline" to="/qrp/reservations">
                Reservations
              </Link>
              <Link className="font-medium text-primary hover:underline" to="/qrp/centre">
                Operations
              </Link>
              <Link className="font-medium text-primary hover:underline" to="/qrp/audit">
                Audit trail
              </Link>
            </nav>
          </WidgetChrome>
        )
      case 'queue':
        return (
          <WidgetChrome
            title="Recent reviews"
            meta={
              <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/approvals">
                Full queue
              </Link>
            }
          >
            {recentRows.length === 0 ? (
              <EmptyState title="Queue is clear" body="Submissions appear when projects request resources." />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recentRows.slice(0, 5).map((row) => (
                  <li key={String(row.workload_id)} className="flex items-center justify-between gap-2 py-2">
                    <Link className="truncate font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      {String(row.workload_id).slice(0, 12)}…
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatEnum(String(row.governance_state || ''))}</span>
                  </li>
                ))}
              </ul>
            )}
          </WidgetChrome>
        )
      case 'activity':
        return (
          <WidgetChrome title="Activity">
            {activityRows.length === 0 ? (
              <EmptyState title="No events" body="Governance activity appears when decisions are recorded." />
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {activityRows.slice(0, 4).map((ev, i) => (
                  <li key={String(ev.id || i)}>
                    <span className="text-foreground">{formatEnum(String(ev.action || ''))}</span>
                  </li>
                ))}
              </ul>
            )}
          </WidgetChrome>
        )
      default:
        return null
    }
  }

  return (
    <DraggableWidgetGrid
      className="overview-dashboard-grid"
      items={widgetItems}
      maxColumns={4}
      cellSize={220}
      gap={12}
      radius={12}
      editable
      onChange={(next: WidgetItem[]) => {
        setWidgetItems(next)
        writeWidgetLayout(lens, next)
      }}
      renderItem={renderWidget}
    />
  )
}

function LifecyclePipeline({ pipeline }: { pipeline: { label: string; to: string; value: string | number; hot: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {pipeline.map((step) => (
        <Link
          key={step.label}
          to={step.to}
          className={`rounded-lg border px-3 py-2 hover:bg-accent ${step.hot ? 'border-warning/40 bg-warning-soft/20' : 'border-border'}`}
        >
          <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{step.label}</span>
          <span className="text-lg font-semibold tabular-nums">{step.value}</span>
        </Link>
      ))}
    </div>
  )
}