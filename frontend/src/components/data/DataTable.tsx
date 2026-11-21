import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { text } from '@/api/qre'
import { EmptyState } from '@/components/data/EmptyState'
import { ListPager } from '@/components/data/ListPager'
import { cn } from '@/lib/utils'

export type DataTableRow = Record<string, unknown>

export type DataTableColumn<T extends object = DataTableRow> = {
  key: string
  label: string
  render?: (row: T) => ReactNode
  /** Client-side sort by raw field value when true. */
  sortable?: boolean
  align?: 'left' | 'right' | 'mono'
}

const PAGE_SIZES = [10, 20, 50, 100] as const

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

export function DataTable<T extends object = DataTableRow>({
  columns,
  rows,
  caption,
  emptyTitle = 'Nothing here yet',
  emptyBody = '',
  pageSize: initialPageSize = 20,
  paginate = true,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  /** Visible or screen-reader table label (H6 / #13). */
  caption?: string
  emptyTitle?: string
  emptyBody?: ReactNode
  /** Rows per page when paginate is true. */
  pageSize?: number
  paginate?: boolean
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() =>
    PAGE_SIZES.includes(initialPageSize as (typeof PAGE_SIZES)[number]) ? initialPageSize : 20,
  )

  const sorted = useMemo(() => {
    if (sortKey == null) return rows
    return [...rows].sort((a, b) => {
      const cmp = compareRows(a as DataTableRow, b as DataTableRow, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const pageCount = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1

  useEffect(() => {
    setPage(1)
  }, [rows.length, sortKey, sortDir, pageSize, paginate])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const visible = useMemo(() => {
    if (!paginate) return sorted
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize, paginate])

  if (rows.length === 0) {
    const emptyType =
      typeof emptyBody === 'string' && emptyBody.toLowerCase().includes('filter') ? 'filtered' : 'first-time'
    return <EmptyState type={emptyType} title={emptyTitle} description={emptyBody} />
  }

  return (
    <div className="space-y-0">
      <div className="scroll-bar-hidden overflow-x-auto">
        <table className="data-table w-full text-left">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="type-caption border-b border-border tracking-[0.12em] text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 font-semibold first:ps-0 last:pe-0',
                    col.align === 'right' && 'text-right',
                    col.align === 'mono' && 'col-mono',
                  )}
                  aria-sort={
                    col.sortable && sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={
                        sortKey === col.key
                          ? `Sort by ${col.label}, ${sortDir === 'asc' ? 'ascending' : 'descending'}`
                          : `Sort by ${col.label}`
                      }
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
            {visible.map((row, index) => (
              <tr key={rowKey(row as DataTableRow, index)} className="border-b border-border/70 last:border-0">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 align-middle first:ps-0 last:pe-0',
                      col.align === 'right' && 'col-numeric',
                      col.align === 'mono' && 'col-mono',
                    )}
                  >
                    {col.render ? col.render(row as T) : text(row as DataTableRow, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate ? (
        <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Rows per page</span>
            <span aria-hidden>Rows</span>
            <select
              className="field-input h-8 min-w-[4.25rem] py-0 text-xs"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <ListPager
            className="border-t-0 pt-0"
            page={page}
            pageCount={pageCount}
            totalItems={sorted.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  )
}

/** @deprecated Import `DataTable` from `@/components/data/DataTable`. */
export const Table = DataTable
export type TableColumn<T extends object = DataTableRow> = DataTableColumn<T>