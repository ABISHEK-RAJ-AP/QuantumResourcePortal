import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { asList, qre, qreDownload, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Notice, Page, RelatedNav } from '@/components/layout/Page'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { evidenceLabelSchema } from '@/lib/validation/schemas'
import { parseForm } from '@/lib/validation/parseForm'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function EvidencePage() {
  const client = useQueryClient()
  const [label, setLabel] = useState('')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureFields, setCaptureFields] = useState<Record<string, string>>({})
  const query = useQuery({
    queryKey: ['evidence'],
    queryFn: () => qre<unknown>('/evidence/snapshots'),
  })
  const capture = useMutation({
    mutationFn: () =>
      qre('/evidence/snapshots', {
        method: 'POST',
        body: JSON.stringify({ label: label || undefined }),
      }),
    onSuccess: () => {
      setLabel('')
      setCaptureOpen(false)
      void client.invalidateQueries({ queryKey: ['evidence'] })
    },
  })
  const download = useMutation({
    mutationFn: (snapshotId: string) =>
      qreDownload(`/evidence/snapshots/${encodeURIComponent(snapshotId)}/download`, `evidence-${snapshotId}.bin`),
  })
  const rows = asList(query.data)
  const fleetScoped = rows.filter((row) => !row.scope_backend_id).length
  const backendScoped = rows.filter((row) => Boolean(row.scope_backend_id)).length
  const latest = rows
    .map((row) => String(row.created_at || ''))
    .filter(Boolean)
    .sort()
    .at(-1)
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/audit' },
        { label: 'Evidence' },
      ]}
      title="Evidence"
      {...opsPageGuidance.evidence}
      actions={
        <button type="button" className="btn-primary" onClick={() => setCaptureOpen(true)}>
          Capture snapshot
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <Modal open={captureOpen} title="Capture snapshot" onClose={() => setCaptureOpen(false)}>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setCaptureFields({})
            const parsed = parseForm(evidenceLabelSchema, { label: label.trim() || undefined })
            if (!parsed.ok) {
              setCaptureFields(parsed.fieldErrors)
              return
            }
            capture.mutate()
          }}
        >
          <FormField label="Label" htmlFor="ev-label" error={captureFields.label} hint="Optional">
            <input
              id="ev-label"
              className={cn(fieldClass, fieldErrorClass(Boolean(captureFields.label)))}
              value={label}
              placeholder="e.g. pre-maintenance fleet"
              onChange={(event) => setLabel(event.target.value)}
              autoFocus
            />
          </FormField>
          {capture.error ? <p className="text-sm text-critical">{message(capture.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCaptureOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={capture.isPending}>
              {capture.isPending ? 'Capturing…' : 'Capture'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip>
        <MetricTile label="Snapshots" value={query.isError ? '—' : rows.length} />
        <MetricTile label="Fleet scope" value={query.isError ? '—' : fleetScoped} />
        <MetricTile label="Backend scope" value={query.isError ? '—' : backendScoped} />
        <MetricTile label="Latest" value={latest ? latest.slice(0, 19).replace('T', ' ') : '—'} />
      </KpiStrip>
      <Card>
        {download.error && <Notice>{message(download.error)}</Notice>}
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No snapshots"
            emptyBody="Capture a snapshot for your organization's fleet or backend scope."
            columns={[
              { key: 'label', label: 'Label' },
              {
                key: 'snapshot_id',
                label: 'Snapshot',
                render: (row) => <CopyableId value={String(row.snapshot_id || '')} />,
              },
              {
                key: 'scope_backend_id',
                label: 'Scope',
                render: (row) => (row.scope_backend_id ? text(row, 'scope_backend_id') : 'Fleet'),
              },
              {
                key: 'created_at',
                label: 'Created',
                render: (row) => <span className="font-mono text-[11px]">{text(row, 'created_at')}</span>,
              },
              { key: 'created_by', label: 'By' },
              {
                key: 'package_sha256',
                label: 'Package SHA-256',
                render: (row) => <span className="font-mono text-[10px] text-muted-foreground">{shortId(String(row.package_sha256 || ''), 16)}</span>,
              },
              {
                key: 'download',
                label: 'Download',
                render: (row) => (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    disabled={download.isPending || !row.snapshot_id}
                    onClick={() => download.mutate(String(row.snapshot_id))}
                  >
                    Download
                  </button>
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/incidents', label: 'Incidents' },
          { to: '/qrp/audit', label: 'Audit trail' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
