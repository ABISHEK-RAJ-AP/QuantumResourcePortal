import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'

import { qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { Card, Notice, Page, PanelHeader, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { formatApiError } from '@/lib/apiMessage'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { ASSET_LIFECYCLE, assetLifecycleIndex } from '@/pages/workspace/inventory/asset-lifecycle'
import { QueryBody, shortId } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'lifecycle' ? 'lifecycle' : 'overview'
  const setTab = (id: string) => {
    if (id === 'overview') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: id }, { replace: true })
  }
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => qre<Row>(`/inventory/assets/${encodeURIComponent(assetId)}`),
    enabled: !!assetId,
  })
  const [moveError, setMoveError] = useState('')
  const move = useMutation({
    mutationFn: (lifecycle_state: string) =>
      qre(`/inventory/assets/${encodeURIComponent(assetId)}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify({ lifecycle_state }),
      }),
    onMutate: () => setMoveError(''),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['asset', assetId] }),
    onError: (err) => setMoveError(formatApiError(err)),
  })
  const row = query.data
  const state = String(row?.lifecycle_state || 'registered')
  const allowed = Array.isArray(row?.allowed_transitions) ? (row.allowed_transitions as string[]) : []

  return (
    <Page
      crumbs={[
        { label: 'Resources', to: '/qrp/inventory' },
        { label: 'Inventory', to: '/qrp/inventory' },
        { label: shortId(assetId, 12) },
      ]}
      title={row ? stateLabel(state) : 'Asset'}
      description={opsPageGuidance.assetDetail.description}
      descriptionHelp={`${opsPageGuidance.assetDetail.descriptionHelp} Asset ${shortId(assetId, 14)}.`}
      steps={ASSET_LIFECYCLE}
      stepIndex={assetLifecycleIndex(state)}
      actions={
        <Link to="/qrp/inventory" className="fs-link text-sm">
          Back to inventory
        </Link>
      }
    >
      <QueryBody query={query}>
        {row && (
          <RecordWorkspace
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'lifecycle', label: 'Lifecycle', count: allowed.length || undefined },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            nextAction={{
              title: allowed.length ? 'Lifecycle transition available' : 'Terminal or blocked',
              body: 'Pick an allowed transition.',
              help: 'Moves follow server allowed_transitions — not every state is reachable from here.',
              primary:
                allowed.length > 0
                  ? { label: 'Move asset', onClick: () => setTab('lifecycle') }
                  : { to: '/qrp/inventory', label: 'Catalogue' },
              secondary: row.provider_id
                ? { to: `/qrp/providers/${row.provider_id}`, label: 'Provider' }
                : undefined,
            }}
            related={[
              { to: '/qrp/scheduling', label: 'Request hold', hint: 'Governance window' },
              { to: '/qrp/jobs', label: 'Provider jobs', hint: 'Execution sample' },
              { to: '/qrp/organization', label: 'Organization', hint: 'Identity & people' },
              ...(row.provider_id ? [{ to: `/qrp/providers/${row.provider_id}`, label: 'Provider record' }] : []),
            ]}
          >
            {moveError ? (
              <Notice tone="critical">
                {moveError}
                <button type="button" className="btn-ghost ms-2 text-sm" onClick={() => setMoveError('')}>
                  Dismiss
                </button>
              </Notice>
            ) : null}
            {tab === 'overview' && (
              <Card className="space-y-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Class</dt>
                    <dd className="mt-1 font-medium">{text(row, 'asset_class')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Execution</dt>
                    <dd className="mt-1 font-medium">{text(row, 'execution_class')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Provider</dt>
                    <dd className="mt-1 font-mono text-xs">{text(row, 'provider_id')}</dd>
                  </div>
                </dl>
                <StatusBadge tone={stateTone(state)} label={stateLabel(state)} />
                <CopyableId value={assetId} keep={18} />
              </Card>
            )}
            {tab === 'lifecycle' && (
              <Card className="space-y-4">
                <PanelHeader title="Allowed transitions" />
                <div className="flex flex-wrap gap-2">
                  {allowed.map((next) => (
                    <button key={next} type="button" disabled={move.isPending} onClick={() => move.mutate(next)} className="btn-primary">
                      {move.isPending ? 'Moving…' : `Move to ${stateLabel(next)}`}
                    </button>
                  ))}
                  {allowed.length === 0 && <p className="text-sm text-muted-foreground">No further transitions.</p>}
                </div>
              </Card>
            )}
          </RecordWorkspace>
        )}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/reservations', label: 'Reservations' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
