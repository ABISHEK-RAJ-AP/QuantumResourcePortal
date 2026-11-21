import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { qre, text } from '@/api/qre'
import { Card, Page, RelatedNav } from '@/components/layout/Page'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function PoolDetailPage() {
  const { poolId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['pool', poolId],
    queryFn: () => qre<Row>(`/virtual-pools/${encodeURIComponent(poolId)}`),
    enabled: !!poolId,
  })
  const [assetId, setAssetId] = useState('')
  const add = useMutation({
    mutationFn: () =>
      qre(`/virtual-pools/${encodeURIComponent(poolId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetId }),
      }),
    onSuccess: () => {
      setAssetId('')
      void client.invalidateQueries({ queryKey: ['pool', poolId] })
      void client.invalidateQueries({ queryKey: ['pools'] })
    },
  })
  const members = Array.isArray(query.data?.members) ? (query.data.members as Row[]) : []
  return (
    <Page
      title={String(query.data?.name || poolId)}
      {...opsPageGuidance.poolDetail}
      actions={
        <Link to="/qrp/pools" className="text-sm font-medium text-primary hover:underline">
          All pools
        </Link>
      }
    >
      <QueryBody query={query}>
        <Card>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              add.mutate()
            }}
          >
            <input required className={fieldClass} value={assetId} placeholder="Asset id" onChange={(event) => setAssetId(event.target.value)} />
            <button type="submit" className={buttonClass} disabled={add.isPending}>
              Add
            </button>
          </form>
          {add.error && <p className="mt-2 text-sm text-critical">{message(add.error)}</p>}
        </Card>
        <Card>
          <Table
            rows={members}
            columns={[
              {
                key: 'native_asset_id',
                label: 'Asset',
                render: (member) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/inventory/${member.asset_id}`}>
                    {text(member, 'native_asset_id')}
                  </Link>
                ),
              },
              { key: 'execution_class', label: 'Execution' },
              { key: 'lifecycle_state', label: 'Lifecycle' },
            ]}
          />
        </Card>
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/pools', label: 'All pools' },
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
