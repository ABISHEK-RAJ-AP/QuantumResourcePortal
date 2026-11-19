import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, LayoutGrid } from 'lucide-react'

import { WorkspaceLayoutPrefsPanel } from '@/components/shell/WorkspaceLayoutPrefsPanel'
import { cn } from '@/lib/utils'

/** Cert Studio–inspired header layout customize (density / charts / KPIs). */
export function WorkspaceLayoutControls() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-medium hover:bg-accent',
          open && 'border-primary/40 bg-accent',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Density, chart height, KPI strip"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <Check className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
        <span className="hidden sm:inline">{open ? 'Done' : 'Layout'}</span>
      </button>

      {open ? (
        <div
          className="absolute end-0 top-[calc(100%+0.4rem)] z-40 w-[min(100vw-2rem,20rem)] rounded-xl border border-border bg-card p-3 shadow-lg"
          role="dialog"
          aria-label="Workspace layout"
        >
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Workspace layout</p>
          <WorkspaceLayoutPrefsPanel />
          <Link
            to="/qrp/settings"
            className="mt-2 block text-center text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            All settings
          </Link>
        </div>
      ) : null}
    </div>
  )
}
