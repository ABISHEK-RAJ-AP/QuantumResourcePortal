import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { asList, qre } from '@/api/qre'
import { DataState } from '@/components/data/DataState'
import { DataTable, type DataTableColumn } from '@/components/data/DataTable'
import { useNearestTableCaption } from '@/components/data/table-caption-context'
import { useOptionalPageChromeTitle } from '@/components/layout/page-context'
import { formatApiError } from '@/lib/apiMessage'

type Row = Record<string, unknown>

export function message(error: unknown) {
  return formatApiError(error)
}

export function useRows(key: string, path: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => asList(await qre<unknown>(path)),
  })
}

export function shortId(value: string, keep = 8) {
  if (!value) return '—'
  return value.length > keep + 1 ? `${value.slice(0, keep)}…` : value
}

export type TableColumn = DataTableColumn<Row>

export function Table(props: Parameters<typeof DataTable<Row>>[0]) {
  const panel = useNearestTableCaption()
  const pageTitle = useOptionalPageChromeTitle()
  const caption = props.caption ?? (panel ? `${panel}` : pageTitle ? `${pageTitle} listing` : undefined)
  return <DataTable {...props} caption={caption} />
}

export function QueryBody({
  query,
  children,
  empty,
  emptyTitle,
  emptyBody,
  compactLoading,
  notReportedTitle,
}: {
  query: {
    isPending: boolean
    error: unknown
    data?: unknown
    refetch?: () => Promise<unknown>
  }
  children: ReactNode
  empty?: boolean
  emptyTitle?: string
  emptyBody?: ReactNode
  compactLoading?: boolean
  notReportedTitle?: string
}) {
  const onRetry =
    query.error && typeof query.refetch === 'function' ? () => void query.refetch!() : undefined
  return (
    <DataState
      pending={query.isPending}
      error={query.error ?? undefined}
      onRetry={onRetry}
      empty={empty}
      emptyTitle={emptyTitle}
      emptyBody={emptyBody}
      compactLoading={compactLoading}
      notReportedTitle={notReportedTitle}
    >
      {children}
    </DataState>
  )
}