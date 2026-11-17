import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DraggableWidgetGrid from '@/components/ui/draggable-widget-grid'
import type { WidgetSize } from '@/components/ui/draggable-widget-grid-layout'
import { DataTable } from '@/components/data/DataTable'
import { Notice, stateLabel, stateTone } from '@/components/layout/Page'
import type { WidgetItem } from '@/components/ui/draggable-widget-grid-layout'
import {
  DEFAULT_OVERVIEW_WIDGETS,
  mergeSavedOrder,
  readWidgetLayout,
  writeWidgetLayout,
} from '@/lib/overviewWidgetLayout'
import { formatDateTime, formatEnum } from '@/lib/display'
import { StatusBadge } from '@/components/status/StatusBadge'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { chartHeightPx } from '@/lib/workspacePrefs'

type Row = Record<string, unknown>

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function shortId(value: string, keep = 12) {
  if (value.length <= keep) return value
  return `${value.slice(0, keep)}…`
}

function WidgetChrome({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="overview-widget flex h-full min-h-0 flex-col">
      <header className="overview-widget__head">
        <h3 className="overview-widget__title">{title}</h3>
        {meta ? <div className="overview-widget__meta">{meta}</div> : null}
      </header>
      <div className="overview-widget__body">{children}</div>
    </div>
  )
}

function ChartFrame({ children, minH = 200 }: { children: ReactNode; minH?: number }) {
  return <div className="min-h-0 w-full flex-1" style={{ minHeight: minH }}>{children}</div>
}

function WidgetPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[10.5rem] flex-1 flex-col items-center justify-center rounded-lg border border-border/70 bg-muted/10 px-3 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function OverviewDashboardGrid({
  lens,
  summaryError,
  summaryPending,
  lifecycleChart,
  ledgerError,
  ledgerPending,
  quotaChart,
  used,
  remaining,
  cap,
  alertSummaryError,
  alertSummaryPending,
  alertBackendChart,
  attemptsError,
  unresolvedRows,
  recentRows,
  activityRows,
  activityError,
}: {
  lens: string
  summaryError: boolean
  summaryPending: boolean
  lifecycleChart: { name: string; value: number }[]
  ledgerError: boolean
  ledgerPending: boolean
  quotaChart: { name: string; value: number; fill?: string }[]
  used: number
  remaining: number
  cap: number
  alertSummaryError: boolean
  alertSummaryPending: boolean
  alertBackendChart: { name: string; value: number; full?: string }[]
  attemptsError: boolean
  unresolvedRows: Row[]
  recentRows: Row[]
  activityRows: Row[]
  activityError: boolean
}) {
  const prefs = useWorkspacePrefs()
  const chartH = chartHeightPx(prefs.chartSize, false)

  const [widgetItems, setWidgetItems] = useState(() =>
    mergeSavedOrder(DEFAULT_OVERVIEW_WIDGETS, readWidgetLayout(lens)),
  )

  useEffect(() => {
    setWidgetItems(mergeSavedOrder(DEFAULT_OVERVIEW_WIDGETS, readWidgetLayout(lens)))
  }, [lens])

  function renderWidget(item: { id: string; size: WidgetSize }) {
    switch (item.id) {
      case 'stages':
        return (
          <WidgetChrome
            title="Request stages"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/approvals">
                Queue
              </Link>
            }
          >
            {summaryError ? (
              <WidgetPlaceholder>Summary unavailable</WidgetPlaceholder>
            ) : summaryPending ? (
              <div className="h-full min-h-[11rem] animate-pulse rounded-lg bg-muted" />
            ) : lifecycleChart.every((d) => d.value === 0) ? (
              <WidgetPlaceholder>Queue clear — no stages yet</WidgetPlaceholder>
            ) : (
              <ChartFrame minH={chartH}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lifecycleChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                    <RechartsTooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {lifecycleChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}
          </WidgetChrome>
        )
      case 'quota':
        return (
          <WidgetChrome
            title="Daily shot quota"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/quotas">
                Ledger
              </Link>
            }
          >
            {ledgerError ? (
              <WidgetPlaceholder>Quota not on this stack</WidgetPlaceholder>
            ) : ledgerPending ? (
              <div className="min-h-[11rem] animate-pulse rounded-lg bg-muted" />
            ) : quotaChart.length === 0 ? (
              <WidgetPlaceholder>No ledger for today</WidgetPlaceholder>
            ) : (
              <div className="flex h-full min-h-[10rem] flex-col gap-2">
                <ChartFrame minH={Math.max(chartH - 40, 140)}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={quotaChart} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={2}>
                        {quotaChart.map((d, i) => (
                          <Cell key={d.name} fill={d.fill || CHART_COLORS[i]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartFrame>
                <p className="shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                  {used} / {cap || used + (remaining || 0)} shots · UTC
                </p>
              </div>
            )}
          </WidgetChrome>
        )
      case 'alerts':
        return (
          <WidgetChrome
            title="Alerts by backend"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/support">
                Alerts
              </Link>
            }
          >
            {alertSummaryError ? (
              <WidgetPlaceholder>Alerts unavailable</WidgetPlaceholder>
            ) : alertSummaryPending ? (
              <div className="min-h-[11rem] animate-pulse rounded-lg bg-muted" />
            ) : alertBackendChart.length === 0 ? (
              <WidgetPlaceholder>No active alerts</WidgetPlaceholder>
            ) : (
              <ChartFrame minH={chartH}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={alertBackendChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(v) => [v, 'Active alerts']}
                      labelFormatter={(_, p) => String((p?.[0]?.payload as { full?: string } | undefined)?.full || '')}
                    />
                    <Bar dataKey="value" fill="var(--chart-5)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}
          </WidgetChrome>
        )
      case 'queue':
        return (
          <WidgetChrome
            title="Review queue"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/approvals">
                All
              </Link>
            }
          >
            <DataTable
              rows={recentRows.slice(0, 8)}
              emptyTitle="Queue clear"
              emptyBody="—"
              columns={[
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) => (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      {shortId(String(row.workload_id || ''), 14)}
                    </Link>
                  ),
                },
                {
                  key: 'governance_state',
                  label: 'State',
                  render: (row) => (
                    <StatusBadge
                      tone={stateTone(String(row.governance_state || ''))}
                      label={stateLabel(String(row.governance_state || 'unknown'))}
                    />
                  ),
                },
                { key: 'created_by', label: 'Requester' },
              ]}
            />
          </WidgetChrome>
        )
      case 'dispatch':
        return (
          <WidgetChrome
            title="Dispatch exceptions"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/reconciliation">
                All
              </Link>
            }
          >
            {attemptsError ? (
              <Notice tone="warning">Dispatch n/a</Notice>
            ) : unresolvedRows.length === 0 ? (
              <WidgetPlaceholder>Dispatch clear</WidgetPlaceholder>
            ) : (
              <DataTable
                rows={unresolvedRows.slice(0, 6)}
                columns={[
                  {
                    key: 'attempt_id',
                    label: 'Attempt',
                    render: (row) => (
                      <Link className="font-medium text-primary hover:underline" to="/qrp/reconciliation">
                        {shortId(String(row.attempt_id || ''), 14)}
                      </Link>
                    ),
                  },
                  {
                    key: 'dispatch_state',
                    label: 'State',
                    render: (row) => (
                      <StatusBadge
                        tone={stateTone(String(row.dispatch_state || ''))}
                        label={stateLabel(String(row.dispatch_state || 'open'))}
                      />
                    ),
                  },
                  {
                    key: 'workload_id',
                    label: 'Request',
                    render: (row) =>
                      row.workload_id ? (
                        <Link className="hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                          {shortId(String(row.workload_id), 12)}
                        </Link>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            )}
          </WidgetChrome>
        )
      case 'decisions':
        return (
          <WidgetChrome
            title="Recent decisions"
            meta={
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/audit">
                Audit
              </Link>
            }
          >
            {activityError ? (
              <Notice tone="warning">Activity n/a</Notice>
            ) : (
              <DataTable
                rows={activityRows.slice(0, 8)}
                emptyTitle="No activity"
                emptyBody="—"
                columns={[
                  {
                    key: 'timestamp',
                    label: 'When',
                    render: (row) => formatDateTime(row.timestamp),
                  },
                  { key: 'actor', label: 'Actor' },
                  { key: 'action', label: 'Action', render: (row) => formatEnum(String(row.action ?? '')) },
                  {
                    key: 'target_id',
                    label: 'Request',
                    render: (row) =>
                      row.target_id ? (
                        <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                          {shortId(String(row.target_id), 12)}
                        </Link>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
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
      cellSize={292}
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