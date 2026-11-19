import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

export const KPI_PAGE_SIZE = 4
export const KPI_ROTATE_MS = 5500

export function chunkItems<T>(items: T[], size = KPI_PAGE_SIZE): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

/** Auto-advance KPI pages; respects prefers-reduced-motion. */
export function useKpiCarouselRotate(
  pageCount: number,
  resetKey: unknown,
  setPageIndex: Dispatch<SetStateAction<number>>,
) {
  useEffect(() => {
    setPageIndex(0)
  }, [resetKey, setPageIndex])

  useEffect(() => {
    if (pageCount <= 1) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const id = window.setInterval(() => {
      setPageIndex((i) => (i + 1) % pageCount)
    }, KPI_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [pageCount, setPageIndex])
}

/** +1 forward, -1 back — for directional carousel slides. */
export function useKpiPageDirection(pageIndex: number, pageCount: number) {
  const prev = useRef(pageIndex)
  const dir = useRef(1)
  if (pageIndex !== prev.current) {
    if (pageCount > 1 && pageIndex === 0 && prev.current === pageCount - 1) {
      dir.current = 1
    } else if (pageCount > 1 && pageIndex === pageCount - 1 && prev.current === 0) {
      dir.current = -1
    } else {
      dir.current = pageIndex > prev.current ? 1 : -1
    }
    prev.current = pageIndex
  }
  return dir.current
}

/** Directional slide with slight rubber-band settle (transform + opacity only). */
export const KPI_SPRING = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 22,
  mass: 0.8,
  velocity: 2,
  restSpeed: 0.4,
  restDelta: 0.002,
}