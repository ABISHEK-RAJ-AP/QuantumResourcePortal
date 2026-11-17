import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

export type OverviewKpiItem = {
  id: string
  label: string
  value: string | number
  hint?: string
  to: string
  tone?: 'neutral' | 'success' | 'warning' | 'critical'
}

const PAGE_SIZE = 4
const ROTATE_MS = 5500

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

/** KPI rail: 4 tiles visible; auto-advances when more than 4 (not in draggable grid). */
export function OverviewKpiScroll({ items }: { items: OverviewKpiItem[] }) {
  const pages = useMemo(() => chunk(items, PAGE_SIZE), [items])
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    setPageIndex(0)
  }, [items.length])

  useEffect(() => {
    if (pages.length <= 1) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const id = window.setInterval(() => {
      setPageIndex((i) => (i + 1) % pages.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [pages.length])

  if (!items.length) return null

  return (
    <section className="overview-kpi-carousel" aria-label="Operational summary">
      <div className="overview-kpi-carousel__viewport">
        {pages.map((page, pi) => (
          <div
            key={pi}
            className={cn('overview-kpi-carousel__page', pi === pageIndex && 'is-active')}
            aria-hidden={pi !== pageIndex}
          >
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
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div className="overview-kpi-carousel__dots" role="tablist" aria-label="KPI pages">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === pageIndex}
              aria-label={`Summary page ${i + 1} of ${pages.length}`}
              className={cn('overview-kpi-carousel__dot', i === pageIndex && 'is-active')}
              onClick={() => setPageIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}