import type { ReactNode } from 'react'

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
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {onSearch && (
        <input
          className="field-input max-w-xs"
          value={search ?? ''}
          placeholder={searchPlaceholder}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={searchPlaceholder}
        />
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
