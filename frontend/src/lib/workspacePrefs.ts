/** Cert Studio–style workspace layout prefs (local, per browser). */

export const WORKSPACE_PREFS_KEY = 'qrp_workspace_prefs'
export const WORKSPACE_PREFS_EVENT = 'qrp:workspace-prefs'

export type Density = 'comfortable' | 'compact'
export type ChartSize = 'sm' | 'md' | 'lg'
export type KpiLayout = 'row' | 'dense' | 'hidden'

export type WorkspacePrefs = {
  version: 1
  density: Density
  chartSize: ChartSize
  kpiLayout: KpiLayout
  /** When true, charts start expanded on pages that support it. */
  chartsExpandedDefault: boolean
}

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  version: 1,
  density: 'comfortable',
  chartSize: 'md',
  kpiLayout: 'row',
  chartsExpandedDefault: false,
}

export function chartHeightPx(size: ChartSize, expanded?: boolean): number {
  if (expanded) return size === 'lg' ? 420 : size === 'sm' ? 320 : 360
  if (size === 'sm') return 140
  if (size === 'lg') return 260
  return 200
}

function normalize(raw: unknown): WorkspacePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORKSPACE_PREFS }
  const o = raw as Partial<WorkspacePrefs>
  return {
    version: 1,
    density: o.density === 'compact' ? 'compact' : 'comfortable',
    chartSize: o.chartSize === 'sm' || o.chartSize === 'lg' ? o.chartSize : 'md',
    kpiLayout: o.kpiLayout === 'dense' || o.kpiLayout === 'hidden' ? o.kpiLayout : 'row',
    chartsExpandedDefault: Boolean(o.chartsExpandedDefault),
  }
}

export function readWorkspacePrefs(): WorkspacePrefs {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFS_KEY)
    if (!raw) return { ...DEFAULT_WORKSPACE_PREFS }
    return normalize(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFS }
  }
}

export function writeWorkspacePrefs(next: WorkspacePrefs) {
  const normalized = normalize(next)
  localStorage.setItem(WORKSPACE_PREFS_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT, { detail: normalized }))
  return normalized
}

export function patchWorkspacePrefs(patch: Partial<WorkspacePrefs>) {
  return writeWorkspacePrefs({ ...readWorkspacePrefs(), ...patch, version: 1 })
}
