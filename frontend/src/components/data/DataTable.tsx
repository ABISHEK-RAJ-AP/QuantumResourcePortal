import { useState, type ReactNode } from 'react'

import { text } from '@/api/qre'
import { EmptyState } from '@/components/layout/Page'

export type DataTableRow = Record<string, unknown>

export type DataTableColumn<T extends DataTableRow = DataTableRow> = {
  key: string
  label: string
  render?: (row: T) => ReactNode
  /** Client-side sort by raw field value when true. */
  sortable?: boolean
}

function compareRows(a: DataTableRow, b: DataTableRow, key: string) {
  const av = a[key]
  const bv = b[key]
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

function rowKey(row: DataTableRow, index: number) {
  return String(
    row.workload_id ?? row.asset_id ?? row.user_id ?? row.id ?? row.membership_id ?? row.alert_id ?? index,
  )
}

export function DataTable<T extends DataTableRow = DataTableRow>({
  columns,
  rows,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'Records appear when the linked service returns data for this tenant.',
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  emptyTitle?: string
  emptyBody?: ReactNode
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />
  }
  const sorted =
    sortKey == null
      ? rows
      : [...rows].sort((a, b) => {
          const cmp = compareRows(a, b, sortKey)
          return sortDir === 'asc' ? cmp : -cmp
        })
  return (
    <div className="scroll-bar-hidden overflow-x-auto">
      <table className="data-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2.5 font-semibold first:ps-0 last:pe-0">
                {col.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                      else {
                        setSortKey(col.key)
                        setSortDir('asc')
                      }
                    }}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-b border-border/70 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2.5 align-middle first:ps-0 last:pe-0">
                  {col.render ? col.render(row) : text(row, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** @deprecated Import `DataTable` from `@/components/data/DataTable`. */
export const Table = DataTable
export type TableColumn<T extends DataTableRow = DataTableRow> = DataTableColumn<T>