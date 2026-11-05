import { useEffect, useRef, useState } from 'react'
import { Check, LayoutGrid, RotateCcw, Rows3, StretchHorizontal } from 'lucide-react'

import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import {
  DEFAULT_WORKSPACE_PREFS,
  patchWorkspacePrefs,
  type ChartSize,
  type Density,
  type KpiLayout,
} from '@/lib/workspacePrefs'
import { cn } from '@/lib/utils'

/** Cert Studio–inspired header layout customize (density / charts / KPIs). */
export function WorkspaceLayoutControls() {
  const prefs = useWorkspacePrefs()
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

          <Field label="Density">
            <Seg
              value={prefs.density}
              options={[
                { id: 'comfortable', label: 'Comfort' },
                { id: 'compact', label: 'Compact' },
              ]}
              onChange={(id) => patchWorkspacePrefs({ density: id as Density })}
            />
          </Field>

          <Field label="Chart height">
            <Seg
              value={prefs.chartSize}
              options={[
                { id: 'sm', label: 'S' },
                { id: 'md', label: 'M' },
                { id: 'lg', label: 'L' },
              ]}
              onChange={(id) => patchWorkspacePrefs({ chartSize: id as ChartSize })}
            />
          </Field>

          <Field label="KPI strip">
            <Seg
              value={prefs.kpiLayout}
              options={[
                { id: 'row', label: 'Row', icon: <StretchHorizontal className="size-3" /> },
                { id: 'dense', label: 'Dense', icon: <Rows3 className="size-3" /> },
                { id: 'hidden', label: 'Hide' },
              ]}
              onChange={(id) => patchWorkspacePrefs({ kpiLayout: id as KpiLayout })}
            />
          </Field>

          <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
            <span>Expand charts by default</span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={prefs.chartsExpandedDefault}
              onChange={(e) => patchWorkspacePrefs({ chartsExpandedDefault: e.target.checked })}
            />
          </label>

          <button
            type="button"
            className="btn-ghost mt-2 inline-flex w-full items-center justify-center gap-1.5 text-xs"
            onClick={() => patchWorkspacePrefs({ ...DEFAULT_WORKSPACE_PREFS })}
          >
            <RotateCcw className="size-3.5" />
            Reset layout
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: string; label: string; icon?: React.ReactNode }[]
  onChange: (id: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1 rounded-lg border border-border p-0.5" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          className={cn(
            'inline-flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition',
            value === o.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
