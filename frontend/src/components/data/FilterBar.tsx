import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type FilterOption = { id: string; label: string }

/** Chip filters + optional search. Clear when any non-default filter active. */
export function FilterBar({
  options,
  value,
  onChange,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  defaultId = 'all',
  trailing,
}: {
  options: readonly FilterOption[]
  value: string
  onChange: (id: string) => void
  search?: string
  onSearch?: (q: string) => void
  searchPlaceholder?: string
  defaultId?: string
  trailing?: ReactNode
}) {
  const dirty = value !== defaultId || Boolean(search?.trim())
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!onSearch) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onSearch('')
      return
    }
    if (event.key === 'Enter') event.preventDefault()
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="search">
      {onSearch && (
        <label className="relative inline-flex h-9 max-w-xs min-w-0 flex-1 items-center rounded-lg border border-input bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
          <span className="pointer-events-none absolute -top-2 left-2 bg-card px-1 text-xs font-medium text-muted-foreground">
            Search
          </span>
          <input
            type="search"
            className="w-full bg-transparent text-sm text-foreground outline-none"
            value={search ?? ''}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onSearchKey}
          />
        </label>
      )}
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(value === opt.id ? 'btn-secondary' : 'btn-ghost')}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
      {dirty && (
        <button
          type="button"
          className="btn-ghost text-muted-foreground"
          onClick={() => {
            onChange(defaultId)
            onSearch?.('')
          }}
        >
          Clear filters
        </button>
      )}
      {trailing}
    </div>
  )
}
