import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { Card, Page, PanelHeader, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { message, QueryBody, Table, shortId } from '@/pages/workspace/shared/helpers'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { INCIDENT_FLOW, incidentStepIndex } from '@/pages/workspace/operations/incident-shared'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function IncidentDetailPage() {
  const { incidentId = '' } = useParams()
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const [note, setNote] = useState('')
  const [tab, setTab] = useState('overview')
  const query = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => qre<Row>(`/incidents/${encodeURIComponent(incidentId)}`),
    enabled: !!incidentId,
  })
  const attempts = useQuery({
    queryKey: ['incident-dispatch', incidentId],
    queryFn: async () => asList(await qre<unknown>('/dispatch-attempts')),
    retry: false,
  })
  const act = useMutation({
    mutationFn: (action: 'acknowledge' | 'investigate' | 'resolve') =>
      qre(`/incidents/${encodeURIComponent(incidentId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'investigate' ? {} : action === 'acknowledge' ? { comment: note || undefined } : { resolution_notes: note },
        ),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['incident', incidentId] }),
  })
  const status = String(query.data?.status || 'OPEN')
  const alerts = Array.isArray(query.data?.alerts) ? (query.data.alerts as Row[]) : []
  const backendId = query.data?.backend_id ? String(query.data.backend_id) : ''
  const relatedAttempts = (attempts.data ?? []).filter((row) =>
    backendId ? String(row.backend_id || '') === backendId : false,
  )
  const resolved = status.toUpperCase() === 'RESOLVED' || status.toUpperCase() === 'CLOSED'
  const nextTitle = resolved
    ? 'Incident closed'
    : status.toUpperCase() === 'INVESTIGATING'
      ? 'Mitigate and resolve'
      : status.toUpperCase() === 'ACKNOWLEDGED'
        ? 'Start investigation'
        : 'Acknowledge / triage'
  const nextBody = resolved ? 'Review evidence and audit trail.' : 'Advance lifecycle when investigation is ready.'
  const nextHelp = resolved
    ? 'Review evidence and organization audit. Reopen only if policy allows.'
    : 'Capture notes, link affected jobs or dispatch attempts, then advance status. Acknowledging is not the same as resolving.'
  const summaryText = String(query.data?.summary ?? '').trim()

  return (
    <Page
      title={String(query.data?.title || incidentId)}
      crumbs={[
        { label: 'Operations', to: '/qrp/incidents' },
        { label: String(query.data?.title || 'Incident') },
      ]}
      description={query.data ? `${stateLabel(status)} incident` : opsPageGuidance.incidentDetail.description}
      descriptionHelp={summaryText || opsPageGuidance.incidentDetail.descriptionHelp}
      steps={INCIDENT_FLOW}
      stepIndex={incidentStepIndex(status)}
      actions={<CopyableId value={incidentId} keep={14} />}
      updatedAt={query.dataUpdatedAt}
    >
      <QueryBody query={query}>
        {query.data && (
          <RecordWorkspace
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'investigate', label: 'Investigate' },
              { id: 'alerts', label: 'Alerts', count: alerts.length },
              { id: 'related', label: 'Related', count: relatedAttempts.length },
              { id: 'records', label: 'Records' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            nextAction={{
              title: nextTitle,
              body: nextBody,
              help: nextHelp,
              blockers: undefined,
              primary: resolved
                ? { to: '/qrp/evidence', label: 'Evidence' }
                : status.toUpperCase() === 'INVESTIGATING'
                  ? { label: 'Resolve', onClick: () => act.mutate('resolve'), disabled: act.isPending }
                  : status.toUpperCase() === 'ACKNOWLEDGED'
                    ? { label: 'Investigate', onClick: () => act.mutate('investigate'), disabled: act.isPending }
                    : { label: 'Acknowledge', onClick: () => act.mutate('acknowledge'), disabled: act.isPending },
              secondary: { to: '/qrp/incidents', label: 'Queue' },
            }}
            related={[
              ...(backendId
                ? [{ to: `/qrp/backends/${backendId}`, label: 'Backend', hint: backendId.slice(0, 18) }]
                : []),
              { to: '/qrp/support', label: 'Alerts', hint: `${alerts.length} linked` },
              { to: '/qrp/reconciliation', label: 'Reconciliation', hint: `${relatedAttempts.length} same backend` },
              { to: '/qrp/jobs', label: 'Provider jobs', hint: 'Execution catalogue' },
              { to: '/qrp/evidence', label: 'Evidence', hint: 'Capture / retrieve' },
              { to: '/qrp/audit', label: 'Audit', hint: 'Consequential actions' },
              { to: '/qrp/centre', label: 'Ops centre', hint: 'Action cockpit' },
            ]}
          >
            {tab === 'overview' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-3">
                  <PanelHeader title="Incident summary" />
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status)} />
                    <StatusBadge
                      tone={String(query.data.severity || '').toLowerCase() === 'critical' ? 'critical' : 'warning'}
                      label={String(query.data.severity || '—')}
                    />
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Owner</dt>
                      <dd className="mt-1 font-medium">{text(query.data, 'owner') || 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Backend</dt>
                      <dd className="mt-1">
                        {backendId ? (
                          <Link className="text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                            {backendId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Alert count</dt>
                      <dd className="mt-1 tabular-nums font-semibold">{String(query.data.alert_count ?? alerts.length)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Updated</dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{text(query.data, 'updated_at')}</dd>
                    </div>
                  </dl>
                  <p className="text-sm text-muted-foreground">{text(query.data, 'summary')}</p>
                </Card>
                <Card className="space-y-3">
                  <PanelHeader
                    title="Lifecycle"
                    tip="Detect and group alerts, acknowledge with optional note, investigate linked jobs and dispatch, then resolve with reason. Acknowledge is not resolve."
                  />
                  <p className="text-sm text-muted-foreground">
                    Current step: <span className="font-medium text-foreground">{stateLabel(status)}</span>
                  </p>
                </Card>
              </div>
            )}

            {tab === 'investigate' && (
              <Card className="space-y-4">
                <PanelHeader title="Investigation actions" />
                <label className="block text-sm">
                  Note / resolution reason
                  <input className={fieldClass} value={note} placeholder="Required for resolve when notes expected" onChange={(event) => setNote(event.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  {status !== 'RESOLVED' && status !== 'ACKNOWLEDGED' && status !== 'INVESTIGATING' && (
                    <button type="button" className={buttonClass} disabled={act.isPending} onClick={() => act.mutate('acknowledge')}>
                      Acknowledge
                    </button>
                  )}
                  {status !== 'RESOLVED' && status !== 'INVESTIGATING' && (
                    <button type="button" className={buttonClass} disabled={act.isPending} onClick={() => act.mutate('investigate')}>
                      Investigate
                    </button>
                  )}
                  {status !== 'RESOLVED' && (
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={act.isPending}
                      onClick={() => {
                        if (note.trim()) {
                          act.mutate('resolve')
                          return
                        }
                        openConfirm({
                          title: 'Resolve without notes?',
                          body: 'Resolution usually expects a note for auditors. Continue without adding one?',
                          confirmLabel: 'Resolve anyway',
                          danger: true,
                          onConfirm: () => act.mutate('resolve'),
                        })
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
                {act.error && <p className="text-sm text-critical">{message(act.error)}</p>}
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  <li>Checklist: confirm affected backend, open related attempts, capture evidence if required.</li>
                  <li>Do not mark resolved solely by acknowledging an alert group.</li>
                </ul>
              </Card>
            )}

            {tab === 'alerts' && (
              <Card>
                <PanelHeader title="Linked alerts">
                <Table
                  rows={alerts}
                  emptyTitle="No alerts linked"
                  emptyBody="Alerts appear when triage attaches detector rows to this case."
                  columns={[
                    {
                      key: 'alert_id',
                      label: 'Alert',
                      render: (row) => (
                        <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${row.alert_id}`}>
                          {text(row, 'alert_id')}
                        </Link>
                      ),
                    },
                    { key: 'severity', label: 'Severity' },
                    { key: 'status', label: 'Status' },
                    { key: 'message', label: 'Message' },
                  ]}
                />
                </PanelHeader>
              </Card>
            )}

            {tab === 'related' && (
              <Card className="space-y-3">
                <PanelHeader title="Dispatch attempts on same backend">
                <Table
                  rows={relatedAttempts}
                  emptyTitle="No matching attempts"
                  emptyBody="Attempts with this backend appear after authorize → record attempt."
                  columns={[
                    {
                      key: 'attempt_id',
                      label: 'Attempt',
                      render: (row) => <CopyableId value={String(row.attempt_id || '')} keep={10} />,
                    },
                    {
                      key: 'workload_id',
                      label: 'Request',
                      render: (row) =>
                        row.workload_id ? (
                          <Link className="text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                            {shortId(String(row.workload_id), 12)}
                          </Link>
                        ) : (
                          '—'
                        ),
                    },
                    {
                      key: 'dispatch_state',
                      label: 'State',
                      render: (row) => (
                        <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || '—'))} />
                      ),
                    },
                  ]}
                />
                <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/reconciliation">
                  Open reconciliation →
                </Link>
                </PanelHeader>
              </Card>
            )}

            {tab === 'records' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="space-y-2">
                  <PanelHeader
                    title="Evidence"
                    tip="Capture operational snapshots that support this incident claim."
                  />
                  <Link className="fs-link text-sm" to="/qrp/evidence">
                    Evidence
                  </Link>
                </Card>
                <Card className="space-y-2">
                  <PanelHeader title="Audit" tip="Lifecycle events append to the organization audit trail." />
                  <Link className="fs-link text-sm" to="/qrp/audit">
                    Audit log
                  </Link>
                </Card>
              </div>
            )}
          </RecordWorkspace>
        )}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/incidents', label: 'All incidents' },
          { to: '/qrp/support', label: 'Alerts' },
          { to: '/qrp/centre', label: 'Operations centre' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
      {confirmDialog}
    </Page>
  )
}
