import { useEffect, useMemo, useState } from 'react'

const DEFAULT_SIZE = 20

export function useClientPagination<T>(items: T[], pageSize = DEFAULT_SIZE) {
  const [page, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setPage(1)
  }, [total, pageSize])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, pageSize, pageCount, total, slice }
}