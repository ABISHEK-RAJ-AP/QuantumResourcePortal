import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router'

import { DataState } from '@/components/data/DataState'
import { StatusBadge } from '@/components/status/StatusBadge'
import { Card, PanelHeader } from '@/components/layout/Page'
import { formatApiError } from '@/lib/apiMessage'

type Row = Record<string, unknown>

/** ColdFront-style quota gate readout for approval detail (API-driven). */
export function QuotaEvaluationPanel({
  query,
  compact,
}: {
  query: UseQueryResult<Row, Error>
  compact?: boolean
}) {
  const body = (
    <DataState
      pending={query.isPending}
      error={query.error ?? undefined}
      onRetry={query.isError ? () => void query.refetch() : undefined}
      compactLoading
      notReportedTitle="Quota evaluate unavailable"
    >
      {query.data ? (
        <div className="space-y-3">
          <StatusBadge
            tone={query.data.allowed ? 'success' : 'critical'}
            label={query.data.allowed ? 'Within daily shot cap' : 'Over daily shot cap'}
          />
          <dl className={compact ? 'grid gap-2 text-sm sm:grid-cols-2' : 'grid gap-3 text-sm sm:grid-cols-4'}>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Requested shots</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{String(query.data.requested_shots ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Remaining today</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{String(query.data.remaining_shots ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Daily cap</dt>
              <dd className="mt-1 font-semibold tabular-nums">{String(query.data.daily_shots_cap ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Reason</dt>
              <dd className="mt-1 font-mono text-xs">{String(query.data.reason_code ?? '—')}</dd>
            </div>
          </dl>
          {typeof query.data.daily_shots_cap === 'number' && typeof query.data.remaining_shots === 'number' ? (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((Number(query.data.daily_shots_cap) - Number(query.data.remaining_shots)) /
                          Math.max(Number(query.data.daily_shots_cap), 1)) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Organization daily shot ledger (UTC). Approval quota stage uses this evaluate endpoint.</p>
            </div>
          ) : null}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{formatApiError(query.error)}</p>
      ) : null}
    </DataState>
  )

  if (compact) return body

  return (
    <Card>
      <PanelHeader
        title="Quota evaluation"
        action={
          <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/quotas">
            Ledger
          </Link>
        }
      />
      {body}
    </Card>
  )
}