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
        <label className="inline-flex min-h-[var(--touch)] max-w-xs min-w-0 flex-1 items-center rounded-[var(--radius-inner)] border border-input bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
          <input
            type="search"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            value={search ?? ''}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onSearchKey}
          />
        </label>
      )}
      <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-inner)] border border-border bg-muted/40 p-1" role="group" aria-label="Filters">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={cn(
              'min-h-8 rounded-md px-2.5 text-sm font-medium transition-colors',
              value === opt.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {dirty && (
        <button
          type="button"
          className="btn-ghost text-muted-foreground"
          onClick={() => {
            onChange(defaultId)
            onSearch?.('')
          }}
        >
          Clear
        </button>
      )}
      {trailing}
    </div>
  )
}
