import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router'

import type { NavItem } from '@/api/rbac'
import { cn } from '@/lib/utils'

export type PaletteNavStatus = 'loading' | 'error' | 'ready'

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
  items: NavItem[]
  status: PaletteNavStatus
  onStartTour?: () => void
}

function focusables(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

/**
 * Route jump list fed by GET /me/navigation. Does not invent commands from the local sidebar NAV.
 */
export function CommandPalette({ open, onClose, items, status, onStartTour }: CommandPaletteProps) {
  const navigate = useNavigate()
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    if (status !== 'ready') return []
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query, status])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
      return
    }
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query, status])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (status !== 'ready' || filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const item = filtered[active]
        if (!item) return
        e.preventDefault()
        navigate(item.route)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, active, navigate, onClose, status])

  useEffect(() => {
    if (!open) return
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = focusables(panelRef.current)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const current = document.activeElement
      if (e.shiftKey) {
        if (current === first || !panelRef.current.contains(current)) {
          e.preventDefault()
          last.focus()
        }
      } else if (current === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onTab)
    return () => window.removeEventListener('keydown', onTab)
  }, [open])

  useEffect(() => {
    if (open) return
    const prev = restoreRef.current
    restoreRef.current = null
    if (prev && document.contains(prev)) prev.focus()
  }, [open])

  if (!open) return null

  let body: ReactNode
  if (status === 'loading') {
    body = <li className="px-3 py-2 text-sm text-muted-foreground">Loading navigation.</li>
  } else if (status === 'error') {
    body = <li className="px-3 py-2 text-sm text-muted-foreground">Could not load navigation.</li>
  } else if (filtered.length === 0) {
    body = <li className="px-3 py-2 text-sm text-muted-foreground">No rows match search.</li>
  } else {
    body = filtered.map((item, i) => (
      <li key={`${item.route}:${item.label}`}>
        <button
          type="button"
          role="option"
          aria-selected={i === active}
          className={cn(
            'flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/40',
            i === active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/70',
          )}
          onMouseEnter={() => setActive(i)}
          onClick={() => {
            navigate(item.route)
            onClose()
          }}
        >
          <span className="truncate">{item.label}</span>
        </button>
      </li>
    ))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 px-4 pt-[12vh]"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">
          Go to page
        </h2>
        <form
          className="flex items-center gap-2 border-b border-border px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            const item = filtered[active]
            if (!item || status !== 'ready') return
            navigate(item.route)
            onClose()
          }}
        >
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages"
            aria-label="Search pages"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            autoComplete="off"
          />
          <button
            type="button"
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-input hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </form>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Pages">
          {body}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">Arrow keys · Enter · Escape</p>
          {onStartTour ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onStartTour()}
            >
              Restart tour
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
