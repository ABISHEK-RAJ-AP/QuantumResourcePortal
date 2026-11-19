import { useEffect, type Dispatch, type SetStateAction } from 'react'

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