import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { KpiCarouselPage, KpiCarouselShell } from '@/components/data/KpiCarouselShell'
import { chunkItems, useKpiCarouselRotate } from '@/components/data/kpiCarouselShared'
import { cn } from '@/lib/utils'

export type OverviewKpiItem = {
  id: string
  label: string
  value: string | number
  hint?: string
  to: string
  tone?: 'neutral' | 'success' | 'warning' | 'critical'
}

/** Home KPI rail — same 4-up carousel as workspace KpiStrip. */
export function OverviewKpiScroll({ items }: { items: OverviewKpiItem[] }) {
  const pages = useMemo(() => chunkItems(items), [items])
  const [pageIndex, setPageIndex] = useState(0)

  useKpiCarouselRotate(pages.length, items.length, setPageIndex)

  if (!items.length) return null

  return (
    <KpiCarouselShell
      pageCount={pages.length}
      pageIndex={pageIndex}
      onSelectPage={setPageIndex}
      ariaLabel="Operational summary"
    >
      {pages.map((page, pi) => (
        <KpiCarouselPage key={pi} active={pi === pageIndex}>
          {page.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                'overview-kpi-tile',
                item.tone === 'success' && 'overview-kpi-tile--success',
                item.tone === 'warning' && 'overview-kpi-tile--warning',
                item.tone === 'critical' && 'overview-kpi-tile--critical',
              )}
            >
              <span className="overview-kpi-tile__label">{item.label}</span>
              <span className="overview-kpi-tile__value tabular-nums">{item.value}</span>
              {item.hint ? <span className="overview-kpi-tile__hint">{item.hint}</span> : null}
            </Link>
          ))}
        </KpiCarouselPage>
      ))}
    </KpiCarouselShell>
  )
}