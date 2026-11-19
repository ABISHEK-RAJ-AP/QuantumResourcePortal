import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ListPager({
  page,
  pageCount,
  onPage,
  className,
  totalItems,
  pageSize,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
  className?: string
  totalItems?: number
  pageSize?: number
}) {
  if (pageCount <= 1 && (totalItems ?? 0) <= (pageSize ?? 20)) return null

  const start = totalItems != null && pageSize ? Math.min((page - 1) * pageSize + 1, totalItems) : undefined
  const end = totalItems != null && pageSize ? Math.min(page * pageSize, totalItems) : undefined

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm', className)}
      aria-label="Pagination"
    >
      {start != null && end != null && totalItems != null ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {start}–{end} of {totalItems}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost inline-flex size-8 items-center justify-center p-0"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-[4.5rem] px-2 text-center text-xs font-medium tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className="btn-ghost inline-flex size-8 items-center justify-center p-0"
          disabled={page >= pageCount}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}