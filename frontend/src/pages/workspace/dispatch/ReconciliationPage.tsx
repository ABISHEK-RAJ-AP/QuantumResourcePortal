import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { FilterBar } from '@/components/data/FilterBar'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { formatApiError } from '@/lib/apiMessage'
import { Card, MetricTile, Notice, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { needsReconcile, RECON_FILTERS } from '@/pages/workspace/dispatch/dispatch-shared'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function ReconciliationPage() {
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const pollMs = useDemoOperationalPolling()
  const [filter, setFilter] = useState<(typeof RECON_FILTERS)[number]['id']>('unresolved')
  const [search, setSearch] = useState('')
  const [reconcileError, setReconcileError] = useState<{ id: string; message: string } | null>(null)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['dispatch-attempts'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    refetchInterval: pollMs,
  })
  const reconcile = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: string }) =>
      qre(`/dispatch-attempts/${encodeURIComponent(id)}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ outcome, reason: outcome }),
      }),
    onMutate: ({ id }) => {
      setReconcilingId(id)
      setReconcileError(null)
    },
    onSuccess: () => {
      setReconcilingId(null)
      void client.invalidateQueries({ queryKey: ['dispatch-attempts'] })
    },
    onError: (err, { id }) => {
      setReconcilingId(null)
      setReconcileError({ id, message: formatApiError(err) })
    },
  })
  const allRows = asList(query.data)
  const unresolvedCount = allRows.filter(needsReconcile).length
  const confirmedCount = allRows.filter((r) => r.dispatch_state === 'dispatch_confirmed').length
  const failedCount = allRows.filter((r) => r.dispatch_state === 'dispatch_failed').length
  let rows = allRows
  if (filter === 'unresolved') rows = allRows.filter(needsReconcile)
  else if (filter !== 'all') rows = allRows.filter((r) => String(r.dispatch_state || '') === filter)
  const q = search.trim().toLowerCase()
  if (q) {
    rows = rows.filter((row) =>
      ['attempt_id', 'workload_id', 'backend_id', 'dispatch_state'].some((key) =>
        String(row[key] ?? '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/approvals' },
        { label: 'Dispatch', to: '/qrp/dispatch' },
        { label: 'Reconciliation' },
      ]}
      title="Reconciliation"
      {...opsPageGuidance.reconciliation}
      updatedAt={query.dataUpdatedAt}
    >
      <RecordWorkspace
        layout="hub"
        tabs={[
          { id: 'work', label: 'Attempts', count: rows.length },
        ]}
        activeTab="work"
        onTabChange={() => undefined}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Needs reconcile" value={unresolvedCount} hint="Authorized or unresolved" tone={unresolvedCount ? 'critical' : 'neutral'} />
          <MetricTile label="Confirmed" value={confirmedCount} hint="External outcome confirmed" tone="success" />
          <MetricTile label="Failed" value={failedCount} hint="Recorded failures" tone="warning" />
        </div>
        {reconcileError ? (
          <Notice tone="critical">
            Reconcile failed for <CopyableId value={reconcileError.id} keep={10} />: {reconcileError.message}
            <button type="button" className="btn-ghost ms-2 text-sm" onClick={() => setReconcileError(null)}>
              Dismiss
            </button>
          </Notice>
        ) : null}
        <Card>
        <FilterBar
          options={RECON_FILTERS}
          value={filter}
          onChange={(id) => setFilter(id as (typeof RECON_FILTERS)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search attempts…"
          defaultId="unresolved"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No attempts"
            emptyBody={
              filter === 'unresolved'
                ? 'No authorized or unresolved attempts for this organization. Flow: approve → authorize → record attempt.'
                : 'Organization dispatch attempts appear after authorisation.'
            }
            columns={[
              {
                key: 'attempt_id',
                label: 'Attempt',
                render: (row) => <CopyableId value={String(row.attempt_id || '')} />,
              },
              {
                key: 'workload_id',
                label: 'Workload',
                render: (row) =>
                  row.workload_id ? (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      {text(row, 'workload_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'dispatch_state',
                label: 'Expected / state',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || 'open'))} />
                ),
              },
              { key: 'execution_class', label: 'Class', sortable: true },
              {
                key: 'external_job_id',
                label: 'Observed job',
                render: (row) =>
                  row.external_job_id ? (
                    <Link className="font-mono text-xs text-primary hover:underline" to={`/qrp/jobs/${row.external_job_id}`}>
                      {text(row, 'external_job_id')}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not reported</span>
                  ),
              },
              {
                key: 'backend_id',
                label: 'Backend',
                render: (row) =>
                  row.backend_id ? (
                    <Link className="hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'actions',
                label: 'Resolve',
                render: (row) =>
                  needsReconcile(row) ? (
                    <span className="flex flex-wrap gap-2">
                      {['confirmed', 'failed', 'unresolved'].map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          disabled={reconcilingId === String(row.attempt_id)}
                          onClick={() => {
                            const id = String(row.attempt_id)
                            openConfirm({
                              title: 'Record dispatch outcome',
                              body: `Mark attempt ${shortId(id, 10)} as ${outcome}? This updates the reconcile ledger.`,
                              confirmLabel: `Mark ${outcome}`,
                              danger: outcome === 'failed',
                              onConfirm: () => reconcile.mutate({ id, outcome }),
                            })
                          }}
                        >
                          {reconcilingId === String(row.attempt_id) ? '…' : outcome}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ),
              },
            ]}
          />
        </QueryBody>
      </Card>
      </RecordWorkspace>
      <RelatedNav
        items={[
          { to: '/qrp/dispatch', label: 'Dispatch' },
          { to: '/qrp/jobs', label: 'Provider jobs' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
      {confirmDialog}
    </Page>
  )
}
