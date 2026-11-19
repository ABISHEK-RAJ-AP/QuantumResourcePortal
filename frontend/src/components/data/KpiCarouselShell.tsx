import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { KPI_SPRING, useKpiPageDirection } from '@/components/data/kpiCarouselShared'
import { cn } from '@/lib/utils'

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
    scale: 0.97,
  }),
}

/** Four KPI tiles per page; spring slide between pages (transform-only, height follows content). */
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
  const direction = useKpiPageDirection(pageIndex, pageCount)
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <section className={cn('overview-kpi-carousel kpi-rail', className)} aria-label={ariaLabel} role="list">
      <div className="overview-kpi-carousel__viewport kpi-rail__viewport">
        {reduceMotion ? (
          <div className="overview-kpi-carousel__page-motion" key={pageIndex}>
            {children}
          </div>
        ) : (
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={pageIndex}
              className="overview-kpi-carousel__page-motion"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={KPI_SPRING}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
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

/** @deprecated Pages render inside KpiCarouselShell directly — kept for type-compat during migration. */
export function KpiCarouselPage({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  if (!active) return null
  return <>{children}</>
}