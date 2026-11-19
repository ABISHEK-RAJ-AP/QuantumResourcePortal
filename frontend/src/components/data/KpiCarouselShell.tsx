import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Four KPI tiles per page; cross-fade between pages when more than four. */
export function KpiCarouselShell({
  pageCount,
  pageIndex,
  onSelectPage,
  ariaLabel,
  className,
  children,
}: {
  pageCount: number
  pageIndex: number
  onSelectPage: (index: number) => void
  ariaLabel: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('overview-kpi-carousel kpi-rail', className)} aria-label={ariaLabel} role="list">
      <div className="overview-kpi-carousel__viewport kpi-rail__viewport">{children}</div>
      {pageCount > 1 ? (
        <div className="overview-kpi-carousel__dots" role="tablist" aria-label="KPI pages">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === pageIndex}
              aria-label={`Page ${i + 1} of ${pageCount}`}
              className={cn('overview-kpi-carousel__dot', i === pageIndex && 'is-active')}
              onClick={() => onSelectPage(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function KpiCarouselPage({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('overview-kpi-carousel__page', active && 'is-active')} aria-hidden={!active}>
      {children}
    </div>
  )
}