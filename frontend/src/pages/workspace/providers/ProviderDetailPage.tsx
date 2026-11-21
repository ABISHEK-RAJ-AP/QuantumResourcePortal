import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { Card, Notice, Page, PanelHeader, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { providerStageIndex } from '@/pages/workspace/providers/provider-stage'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, shortId } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ProviderDetailPage() {
  const { providerId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'manifest' || tabParam === 'status' ? tabParam : 'overview'
  const setTab = (id: string) => {
    if (id === 'overview') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: id }, { replace: true })
  }
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['providers'],
    queryFn: () => qre<unknown>('/providers'),
  })
  const row = asList(query.data).find((item) => item.provider_id === providerId)
  const integration = (row?.integration as Row | undefined) ?? {}
  const [operations, setOperations] = useState('observe,submit')
  const [classes, setClasses] = useState('hardware')
  const save = useMutation({
    mutationFn: () =>
      qre(`/providers/${encodeURIComponent(providerId)}/onboarding`, {
        method: 'POST',
        body: JSON.stringify({
          operations: operations.split(',').map((part) => part.trim()).filter(Boolean),
          execution_classes: classes.split(',').map((part) => part.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  })
  const move = useMutation({
    mutationFn: (status: string) =>
      qre(`/providers/${encodeURIComponent(providerId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  })
  return (
    <Page
      crumbs={[
        { label: 'Resources', to: '/qrp/providers' },
        { label: 'Providers', to: '/qrp/providers' },
        { label: String(row?.provider_name || shortId(providerId, 12)) },
      ]}
      title={String(row?.provider_name || providerId)}
      {...opsPageGuidance.providerDetail}
      steps={[
        { id: 'register', label: 'Register' },
        { id: 'manifest', label: 'Manifest' },
        { id: 'activate', label: 'Activate' },
      ]}
      stepIndex={providerStageIndex(String(integration.stage || 'I1'))}
      actions={
        <Link to="/qrp/providers" className="text-sm font-medium text-primary hover:underline">
          All providers
        </Link>
      }
    >
      <QueryBody query={query}>
        {row && (
          <RecordWorkspace
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'manifest', label: 'Manifest' },
              { id: 'status', label: 'Status' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            nextAction={{
              title: String(integration.stage || 'I1') === 'I5' ? 'Integration complete' : 'Advance onboarding',
              body:
                String(integration.manifest_registered) === 'true' || integration.manifest_registered === true
                  ? 'Manifest on file.'
                  : 'Publish manifest first.',
              help:
                String(integration.manifest_registered) === 'true' || integration.manifest_registered === true
                  ? 'Activate when collector evidence is acceptable.'
                  : 'Register operations and execution classes before activating this provider.',
              primary: { label: 'Publish manifest', onClick: () => setTab('manifest') },
              secondary: { to: '/qrp/connectors', label: 'Connectors board' },
            }}
            related={[
              { to: '/qrp/inventory', label: 'Inventory', hint: 'Assets on this provider' },
              { to: '/qrp/connectors', label: 'Connectors', hint: text(integration, 'stage') },
              { to: '/qrp/jobs', label: 'Provider jobs', hint: 'Execution sample' },
              { to: '/qrp/organization', label: 'Organization', hint: 'Tenant identity' },
            ]}
          >
            {tab === 'overview' && (
              <Card className="space-y-2 text-sm">
                <StatusBadge tone={stateTone(String(row.status || 'active'))} label={stateLabel(String(row.status || 'active'))} />
                <p>
                  Stage <span className="font-medium">{text(integration, 'stage')}</span>
                </p>
                <p>
                  Manifest {(integration.manifest_registered ? 'registered' : 'not registered') as string}
                </p>
                <p>
                  Collector {text(integration, 'collector_last_status') || 'not reported'}
                </p>
                <CopyableId value={providerId} keep={16} />
              </Card>
            )}
            {tab === 'manifest' && (
              <Card>
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    save.mutate()
                  }}
                >
                  <label className="text-sm">
                    Operations (comma-separated)
                    <input className={fieldClass} value={operations} onChange={(event) => setOperations(event.target.value)} />
                  </label>
                  <label className="text-sm">
                    Execution classes (comma-separated)
                    <input className={fieldClass} value={classes} onChange={(event) => setClasses(event.target.value)} />
                  </label>
                  <p className="text-xs text-muted-foreground">Current: {(integration.operations as string[] | undefined)?.join(', ') || '—'}</p>
                  <div>
                    <button type="submit" className={buttonClass} disabled={save.isPending}>
                      {save.isPending ? 'Saving…' : 'Publish manifest'}
                    </button>
                    {save.isSuccess && <p className="mt-2 text-sm text-success-text">Manifest saved.</p>}
                    {save.error && <p className="mt-2 text-sm text-critical">{message(save.error)}</p>}
                  </div>
                </form>
              </Card>
            )}
            {tab === 'status' && (
              <Card className="space-y-3 text-sm">
                <PanelHeader title="Catalogue status" />
                <p>Operations {(integration.operations as string[] | undefined)?.join(', ') || '—'}</p>
                <div className="flex flex-wrap gap-2">
                  {['active', 'suspended'].map((status) => (
                    <button key={status} type="button" className={buttonClass} disabled={move.isPending} onClick={() => move.mutate(status)}>
                      Set {stateLabel(status)}
                    </button>
                  ))}
                </div>
                {move.error && <p className="text-critical">{message(move.error)}</p>}
              </Card>
            )}
          </RecordWorkspace>
        )}
        {!row && !query.isLoading && <Notice tone="warning">This provider is not in the catalogue.</Notice>}
      </QueryBody>
    </Page>
  )
}
