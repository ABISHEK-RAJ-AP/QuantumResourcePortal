import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { Modal } from '@/components/ui/Modal'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { parseForm } from '@/lib/validation/parseForm'
import { poolCreateSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function PoolsPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const query = useQuery({
    queryKey: ['pools'],
    queryFn: () => qre<unknown>('/virtual-pools'),
  })
  const inventory = useQuery({
    queryKey: ['assets-pools'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
    retry: false,
  })
  const [name, setName] = useState('')
  const [poolFields, setPoolFields] = useState<Record<string, string>>({})
  const create = useMutation({
    mutationFn: (poolName: string) => qre('/virtual-pools', { method: 'POST', body: JSON.stringify({ name: poolName }) }),
    onSuccess: () => {
      setName('')
      setCreateOpen(false)
      void client.invalidateQueries({ queryKey: ['pools'] })
    },
  })
  const all = asList(query.data)
  const rows = all.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['name', 'pool_id', 'description'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const memberTotal = all.reduce((sum, row) => sum + (Number(row.member_count) || 0), 0)
  const emptyPools = all.filter((row) => Number(row.member_count || 0) === 0).length
  const headerAction = (
    <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
      New pool
    </button>
  )
  const body = (
    <>
      {!embedded ? null : <div className="mb-3 flex justify-end">{headerAction}</div>}
      <Modal open={createOpen} title="New pool" onClose={() => setCreateOpen(false)}>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setPoolFields({})
            const parsed = parseForm(poolCreateSchema, { name })
            if (!parsed.ok) {
              setPoolFields(parsed.fieldErrors)
              return
            }
            create.mutate(parsed.data.name)
          }}
        >
          <FormField label="Pool name" htmlFor="pool-name" error={poolFields.name}>
            <input
              id="pool-name"
              className={cn(fieldClass, fieldErrorClass(Boolean(poolFields.name)))}
              value={name}
              placeholder="Pool name"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormField>
          {create.error ? <p className="text-sm text-critical">{message(create.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip>
        <MetricTile label="Pools" value={query.isError ? '—' : all.length} />
        <MetricTile label="Members" value={query.isError ? '—' : memberTotal} />
        <MetricTile label="Empty" value={query.isError ? '—' : emptyPools} tone={emptyPools ? 'warning' : 'neutral'} />
        <MetricTile label="Assets" value={inventory.isError ? '—' : (inventory.data?.length ?? 0)} />
      </KpiStrip>
      <Card>
        <FilterBar
          options={[{ id: 'all', label: 'All' }]}
          value="all"
          onChange={() => undefined}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search pools…"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No pools"
            emptyBody="Create an organization pool, then add registered inventory members."
            columns={[
              {
                key: 'name',
                label: 'Pool',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/pools/${row.pool_id}`}>
                    {text(row, 'name')}
                  </Link>
                ),
              },
              {
                key: 'pool_id',
                label: 'Id',
                render: (row) => <CopyableId value={String(row.pool_id || '')} />,
              },
              { key: 'member_count', label: 'Members', sortable: true },
              { key: 'description', label: 'Description' },
            ]}
          />
        </QueryBody>
      </Card>
    </>
  )
  if (embedded) return body
  return (
    <Page
      crumbs={[{ label: 'Resources', to: '/qrp/inventory' }, { label: 'Pools' }]}
      title="Resource pools"
      {...opsPageGuidance.pools}
      actions={headerAction}
      updatedAt={query.dataUpdatedAt}
    >
      {body}
      <RelatedNav
        items={[
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/scheduling', label: 'Scheduling' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
