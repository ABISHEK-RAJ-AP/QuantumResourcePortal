import { Children, useMemo, useState, type ReactNode } from 'react'

import { KpiCarouselShell } from '@/components/data/KpiCarouselShell'
import { chunkItems, useKpiCarouselRotate } from '@/components/data/kpiCarouselShared'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { cn } from '@/lib/utils'

/** KPI strip: 4 tiles per row; cycles when more than 4 (workspace pages). */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  const prefs = useWorkspacePrefs()
  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children])
  const pages = useMemo(() => chunkItems(items), [items])
  const [pageIndex, setPageIndex] = useState(0)

  useKpiCarouselRotate(pages.length, items.length, setPageIndex)

  if (prefs.kpiLayout === 'hidden') return null
  if (!items.length) return null

  return (
    <KpiCarouselShell
      pageCount={pages.length}
      pageIndex={pageIndex}
      onSelectPage={setPageIndex}
      ariaLabel="Key metrics"
      className={cn(prefs.kpiLayout === 'dense' && 'kpi-rail--dense', className)}
    >
      {(pages[pageIndex] ?? []).map((child, idx) => (
        <div key={idx} className="kpi-rail__cell" role="listitem">
          {child}
        </div>
      ))}
    </KpiCarouselShell>
  )
}