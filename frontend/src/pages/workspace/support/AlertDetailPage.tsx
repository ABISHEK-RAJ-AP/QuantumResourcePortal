import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { KpiStrip } from '@/components/data/KpiStrip'
import {
  Card,
  DetailSkeleton,
  EmptyState,
  MetricTile,
  Notice,
  Page,
  PanelHeader,
  RelatedNav,
  stateLabel,
  stateTone,
} from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import {
  alertMetricUnit,
  explainAlert,
  formatAlertAge,
  type AlertRow,
} from '@/pages/workspace/support/alert-detail-shared'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { message, QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'

type Row = AlertRow

export function AlertDetailPage() {
  const { alertId = '' } = useParams()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const query = useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => qre<Row>(`/alerts/${encodeURIComponent(alertId)}`),
    enabled: !!alertId,
  })
  const row = query.data
  const resourceId = row?.resource_id ? String(row.resource_id) : ''
  const backendId = row?.backend_id ? String(row.backend_id) : ''
  const incidentId = row?.incident_id ? String(row.incident_id) : ''

  const related = useQuery({
    queryKey: ['alert-related', resourceId],
    queryFn: async () => asList(await qre<unknown>(`/alerts?resource_id=${encodeURIComponent(resourceId)}&limit=20`)),
    enabled: !!resourceId,
    retry: false,
  })
  const incident = useQuery({
    queryKey: ['alert-incident', incidentId],
    queryFn: () => qre<Row>(`/incidents/${encodeURIComponent(incidentId)}`),
    enabled: !!incidentId,
    retry: false,
  })
  const backend = useQuery({
    queryKey: ['alert-backend', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
    retry: false,
  })

  const invalidateAlert = () => {
    void client.invalidateQueries({ queryKey: ['alert', alertId] })
    void client.invalidateQueries({ queryKey: ['alert-related', resourceId] })
    void client.invalidateQueries({ queryKey: ['alerts'] })
  }

  const advance = useMutation({
    mutationFn: async (action: 'acknowledge' | 'resolve') => {
      if (note.trim()) {
        await qre(`/alerts/${encodeURIComponent(alertId)}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text: note.trim() }),
        })
      }
      return qre(`/alerts/${encodeURIComponent(alertId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'acknowledge'
            ? { comment: note.trim() || undefined }
            : { resolution_notes: note.trim() || undefined },
        ),
      })
    },
    onSuccess: () => {
      setNote('')
      invalidateAlert()
      if (incidentId) void client.invalidateQueries({ queryKey: ['alert-incident', incidentId] })
    },
  })
  const comment = useMutation({
    mutationFn: () =>
      qre(`/alerts/${encodeURIComponent(alertId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: note }),
      }),
    onSuccess: () => {
      setNote('')
      invalidateAlert()
    },
  })

  const status = String(row?.status || 'open')
  const comments = Array.isArray(row?.comments) ? (row.comments as Row[]) : []
  const current = Number(row?.current_value)
  const threshold = Number(row?.threshold_value)
  const unit = alertMetricUnit(String(row?.alert_type || ''))
  const delta = Number.isFinite(current) && Number.isFinite(threshold) ? current - threshold : null
  const breachPct =
    Number.isFinite(current) && Number.isFinite(threshold) && threshold !== 0
      ? Math.round((current / threshold) * 100)
      : null
  const severity = String(row?.severity || 'info').toLowerCase()
  const relatedRows = (related.data ?? []).filter((r) => String(r.alert_id) !== alertId)
  const incidentAlerts = Array.isArray(incident.data?.alerts) ? (incident.data!.alerts as Row[]) : []
  const siblingOnBackend = incidentAlerts.filter((r) => String(r.alert_id) !== alertId).slice(0, 8)

  return (
    <Page
      title={row ? String(row.alert_type || 'Alert') : 'Alert'}
      description={row ? `${severity.toUpperCase()} · ${formatAlertAge(row.detected_at)}` : opsPageGuidance.alertDetail.description}
      descriptionHelp={
        row
          ? String(row.message || opsPageGuidance.alertDetail.descriptionHelp)
          : `Alert ${shortId(alertId, 12)} on the shared fabric.`
      }
      crumbs={[
        { label: 'Operations', to: '/qrp/support' },
        { label: 'Alert' },
      ]}
      actions={
        <span className="flex flex-wrap items-center gap-3">
          <CopyableId value={alertId} keep={14} />
          {incidentId ? (
            <Link to={`/qrp/incidents/${incidentId}`} className="btn-primary">
              Open incident
            </Link>
          ) : (
            <Link to="/qrp/support" className="fs-link text-sm">
              Alert queue
            </Link>
          )}
        </span>
      }
    >
      {query.isPending ? (
        <DetailSkeleton />
      ) : (
        <QueryBody query={query}>
          {row && (
            <div className="space-y-4">
              <KpiStrip>
                <MetricTile
                  label={`Observed${unit ? ` (${unit})` : ''}`}
                  value={Number.isFinite(current) ? current.toFixed(2) : '—'}
                  hint="Detector current_value"
                  tone={severity === 'critical' ? 'critical' : 'warning'}
                />
                <MetricTile
                  label={`Threshold${unit ? ` (${unit})` : ''}`}
                  value={Number.isFinite(threshold) ? threshold.toFixed(2) : '—'}
                  hint="Rule floor / ceiling"
                />
                <MetricTile
                  label="Delta"
                  value={delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${unit}`}
                  hint="observed − threshold"
                  tone={delta != null && delta < 0 ? 'critical' : 'neutral'}
                />
                <MetricTile
                  label="% of threshold"
                  value={breachPct == null ? '—' : `${breachPct}%`}
                  hint="current / threshold"
                  tone={breachPct != null && breachPct < 100 ? 'critical' : 'neutral'}
                />
                <MetricTile label="Age" value={formatAlertAge(row.detected_at)} hint={String(row.detected_at || '')} /></KpiStrip>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <Card className="space-y-3">
                    <PanelHeader
                      title="Investigation summary"
                      action={
                        <span className="flex flex-wrap gap-2">
                          <StatusBadge tone={severity === 'critical' ? 'critical' : 'warning'} label={String(row.severity || 'info')} />
                          <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status)} />
                        </span>
                      }
                    />
                    <p className="text-sm leading-relaxed">{explainAlert(row, current, threshold)}</p>
                    <dl className="grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Resource</dt>
                        <dd className="mt-1">
                          <span className="text-xs text-muted-foreground">{text(row, 'resource_type')} · </span>
                          <span className="font-mono text-xs">{text(row, 'resource_id')}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend</dt>
                        <dd className="mt-1 space-y-1">
                          {backendId ? (
                            <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                              {backend.data?.backend_name ? String(backend.data.backend_name) : backendId}
                            </Link>
                          ) : (
                            '—'
                          )}
                          {backend.data ? (
                            <p className="text-xs text-muted-foreground">
                              {String(backend.data.operational_status || '—')} · {String(backend.data.qubit_count ?? '—')} qubits ·{' '}
                              {String(backend.data.provider_id || '')}
                            </p>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Detected (UTC)</dt>
                        <dd className="mt-1 font-mono text-xs">{text(row, 'detected_at')}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Ack / resolve</dt>
                        <dd className="mt-1 text-xs">
                          {text(row, 'acknowledged_by')} · {text(row, 'resolved_at')}
                        </dd>
                      </div>
                    </dl>
                    </Card>

                  <Card className="space-y-3">
                    <PanelHeader
                      title="Related on this resource"
                      action={
                        related.isError ? (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        ) : (
                          <span className="text-xs text-muted-foreground tabular-nums">{relatedRows.length} other</span>
                        )
                      }
                    >
                    {related.isPending ? (
                      <div className="h-20 animate-pulse rounded-lg bg-muted" />
                    ) : relatedRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No other alerts on {resourceId || 'this resource'}.</p>
                    ) : (
                      <Table
                        rows={relatedRows.slice(0, 8)}
                        columns={[
                          {
                            key: 'alert_id',
                            label: 'Alert',
                            render: (r) => (
                              <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${r.alert_id}`}>
                                {shortId(String(r.alert_id || ''), 12)}
                              </Link>
                            ),
                          },
                          {
                            key: 'severity',
                            label: 'Sev',
                            render: (r) => (
                              <StatusBadge
                                tone={String(r.severity).toLowerCase() === 'critical' ? 'critical' : 'warning'}
                                label={String(r.severity || '')}
                              />
                            ),
                          },
                          {
                            key: 'status',
                            label: 'Status',
                            render: (r) => (
                              <StatusBadge tone={stateTone(String(r.status || '').toLowerCase())} label={stateLabel(String(r.status || ''))} />
                            ),
                          },
                          {
                            key: 'current_value',
                            label: 'Value',
                            render: (r) => {
                              const v = Number(r.current_value)
                              return Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : '—'
                            },
                          },
                          {
                            key: 'detected_at',
                            label: 'Age',
                            render: (r) => formatAlertAge(r.detected_at),
                          },
                        ]}
                      />
                    )}
                    </PanelHeader>
                  </Card>

                  {incidentId ? (
                    <Card className="space-y-3">
                      <PanelHeader
                        title="Incident group"
                        action={
                          <Link className="text-xs font-medium text-primary hover:underline" to={`/qrp/incidents/${incidentId}`}>
                            Full incident
                          </Link>
                        }
                      >
                      {incident.isError ? (
                        <EmptyState title="Incident unavailable" body={message(incident.error)} />
                      ) : incident.isPending ? (
                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                      ) : (
                        <>
                          <p className="text-sm font-medium">{String(incident.data?.title || incidentId)}</p>
                          <p className="text-sm text-muted-foreground">{String(incident.data?.summary || '')}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <StatusBadge
                              tone={String(incident.data?.severity).toLowerCase() === 'critical' ? 'critical' : 'warning'}
                              label={String(incident.data?.severity || '')}
                            />
                            <StatusBadge
                              tone={stateTone(String(incident.data?.status || '').toLowerCase())}
                              label={stateLabel(String(incident.data?.status || ''))}
                            />
                            <span className="rounded-md border border-border px-2 py-1 tabular-nums">
                              {String(incident.data?.alert_count ?? siblingOnBackend.length)} alerts grouped
                            </span>
                          </div>
                          {siblingOnBackend.length > 0 ? (
                            <Table
                              rows={siblingOnBackend}
                              columns={[
                                {
                                  key: 'alert_id',
                                  label: 'Sibling alert',
                                  render: (r) => (
                                    <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${r.alert_id}`}>
                                      {shortId(String(r.alert_id || ''), 10)}
                                    </Link>
                                  ),
                                },
                                { key: 'resource_id', label: 'Resource' },
                                {
                                  key: 'current_value',
                                  label: 'Value',
                                  render: (r) => {
                                    const v = Number(r.current_value)
                                    return Number.isFinite(v) ? v.toFixed(1) : '—'
                                  },
                                },
                                {
                                  key: 'status',
                                  label: 'Status',
                                  render: (r) => (
                                    <StatusBadge
                                      tone={stateTone(String(r.status || '').toLowerCase())}
                                      label={stateLabel(String(r.status || ''))}
                                    />
                                  ),
                                },
                              ]}
                            />
                          ) : null}
                        </>
                      )}
                      </PanelHeader>
                    </Card>
                  ) : (
                    <Notice tone="warning">Not linked to an incident yet. Grouping happens when the sync job attaches alerts.</Notice>
                  )}
                </div>

                <div className="space-y-4">
                  <Card className="space-y-3">
                    <PanelHeader
                      title="Next actions"
                      tip={
                        <ol className="list-decimal space-y-1.5 ps-4 text-sm">
                          <li>Confirm reading vs threshold (alert detector).</li>
                          <li>Check sibling alerts on the same backend via the incident group.</li>
                          <li>Acknowledge to claim ownership, then add notes.</li>
                          <li>Resolve when cleared or accepted with a note.</li>
                        </ol>
                      }
                    />
                    <div className="flex flex-col gap-2 text-sm">
                      {backendId ? (
                        <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                          Backend operational context →
                        </Link>
                      ) : null}
                      <Link className="font-medium text-primary hover:underline" to="/qrp/centre">
                        Operations Centre →
                      </Link>
                      <Link className="font-medium text-primary hover:underline" to="/qrp/queues">
                        Queues (if dispatch blocked) →
                      </Link>
                    </div>
                  </Card>

                  <Card className="space-y-3">
                    <PanelHeader title="Investigation trail" />
                    <div className="flex flex-wrap gap-2">
                      {status !== 'ACKNOWLEDGED' && status !== 'RESOLVED' && (
                        <button type="button" className={buttonClass} disabled={advance.isPending} onClick={() => advance.mutate('acknowledge')}>
                          Acknowledge
                        </button>
                      )}
                      {status !== 'RESOLVED' && (
                        <button type="button" className="btn-ghost" disabled={advance.isPending} onClick={() => advance.mutate('resolve')}>
                          Resolve
                        </button>
                      )}
                    </div>
                    {advance.error && <p className="text-sm text-critical">{message(advance.error)}</p>}
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        comment.mutate()
                      }}
                    >
                      <label className="text-sm">
                        Note (saved on comment; also attached when you Ack/Resolve)
                        <textarea
                          required
                          className={`${fieldClass} min-h-[100px] w-full`}
                          value={note}
                          placeholder="What you checked, who you notified, why you ack/resolve…"
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      <button type="submit" className={buttonClass} disabled={comment.isPending || !note.trim()}>
                        {comment.isPending ? 'Posting…' : 'Post to trail'}
                      </button>
                    </form>
                    {comment.error && <p className="text-sm text-critical">{message(comment.error)}</p>}
                    <ul className="divide-y divide-border/70 text-sm">
                      <li className="py-2 first:pt-0">
                        <span className="font-medium">System</span>
                        <span className="text-muted-foreground"> · {formatAlertAge(row.detected_at)}</span>
                        <p className="mt-0.5 text-muted-foreground">Detected · {text(row, 'detected_at')}</p>
                      </li>
                      {row.acknowledged_by ? (
                        <li className="py-2">
                          <span className="font-medium">{text(row, 'acknowledged_by')}</span>
                          <p className="mt-0.5 text-muted-foreground">Acknowledged</p>
                        </li>
                      ) : null}
                      {row.resolved_at ? (
                        <li className="py-2">
                          <span className="font-medium">Resolved</span>
                          <span className="text-muted-foreground"> · {text(row, 'resolved_at')}</span>
                        </li>
                      ) : null}
                      {comments.map((c) => (
                        <li key={String(c.comment_id)} className="py-2">
                          <span className="font-medium">{text(c, 'author')}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            · {c.role ? `${String(c.role)} · ` : ''}
                            {formatAlertAge(c.created_at)}
                          </span>
                          <p className="mt-0.5 whitespace-pre-wrap">{text(c, 'text')}</p>
                        </li>
                      ))}
                      {comments.length === 0 && !row.acknowledged_by && (
                        <li className="py-2 text-muted-foreground">No operator notes yet. Post what you verified.</li>
                      )}
                    </ul>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </QueryBody>
      )}
      <RelatedNav
        items={[
          { to: '/qrp/support', label: 'Alert queue' },
          { to: '/qrp/incidents', label: 'Incidents' },
          { to: '/qrp/centre', label: 'Operations centre' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
