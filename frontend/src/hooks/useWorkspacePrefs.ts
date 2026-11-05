import { useEffect, useState } from 'react'

import {
  readWorkspacePrefs,
  WORKSPACE_PREFS_EVENT,
  type WorkspacePrefs,
} from '@/lib/workspacePrefs'

/** Live workspace layout prefs (density, chart size, KPI layout). */
export function useWorkspacePrefs() {
  const [prefs, setPrefs] = useState<WorkspacePrefs>(() =>
    typeof window === 'undefined' ? { version: 1, density: 'comfortable', chartSize: 'md', kpiLayout: 'row', chartsExpandedDefault: false } : readWorkspacePrefs(),
  )

  useEffect(() => {
    setPrefs(readWorkspacePrefs())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'qrp_workspace_prefs') setPrefs(readWorkspacePrefs())
    }
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<WorkspacePrefs>).detail
      if (detail) setPrefs(detail)
      else setPrefs(readWorkspacePrefs())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(WORKSPACE_PREFS_EVENT, onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(WORKSPACE_PREFS_EVENT, onCustom)
    }
  }, [])

  return prefs
}
