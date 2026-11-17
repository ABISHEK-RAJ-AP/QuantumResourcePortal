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

/** Fixed KPI rail (not in draggable grid) — horizontal scroll like Q-TeleScope fleet strip. */
export function OverviewKpiScroll({ items }: { items: OverviewKpiItem[] }) {
  if (!items.length) return null
  return (
    <section className="overview-kpi-scroll" aria-label="Operational summary">
      <div className="overview-kpi-scroll__track">
        {items.map((item) => (
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
    </section>
  )
}