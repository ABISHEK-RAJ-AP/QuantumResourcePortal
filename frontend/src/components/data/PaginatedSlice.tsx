import type { ReactNode } from 'react'

import { ListPager } from '@/components/data/ListPager'
import { useClientPagination } from '@/hooks/useClientPagination'

/** Paginate arbitrary list UIs (cards, grids) — not only DataTable. */
export function PaginatedSlice<T>({
  items,
  pageSize = 12,
  children,
}: {
  items: T[]
  pageSize?: number
  children: (slice: T[]) => ReactNode
}) {
  const { slice, page, setPage, pageCount, total, pageSize: size } = useClientPagination(items, pageSize)
  if (!items.length) return null
  return (
    <div className="space-y-3">
      {children(slice)}
      <ListPager page={page} pageCount={pageCount} totalItems={total} pageSize={size} onPage={setPage} />
    </div>
  )
}