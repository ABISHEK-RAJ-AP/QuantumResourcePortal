import { RotateCcw, Rows3, StretchHorizontal } from 'lucide-react'

import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import {
  DEFAULT_WORKSPACE_PREFS,
  patchWorkspacePrefs,
  type ChartSize,
  type Density,
  type KpiLayout,
} from '@/lib/workspacePrefs'
import { cn } from '@/lib/utils'

/** Inline workspace layout controls (Settings + header popover). */
export function WorkspaceLayoutPrefsPanel({ className }: { className?: string }) {
  const prefs = useWorkspacePrefs()

  return (
    <div className={cn('space-y-3 text-sm', className)}>
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

      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
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
        className="btn-ghost inline-flex w-full items-center justify-center gap-1.5 text-xs"
        onClick={() => patchWorkspacePrefs({ ...DEFAULT_WORKSPACE_PREFS })}
      >
        <RotateCcw className="size-3.5" />
        Reset layout
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
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
            'inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition',
            value === o.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.icon}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  )
}