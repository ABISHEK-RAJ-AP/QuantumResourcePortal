import type { ReactNode } from 'react'

import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { cn } from '@/lib/utils'

/** KPI / metric strip that respects workspace layout prefs. */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  const prefs = useWorkspacePrefs()
  if (prefs.kpiLayout === 'hidden') return null
  return (
    <div className={cn('kpi-rail', className)} role="list" aria-label="Key metrics">
      <div
        className={cn(
          'kpi-rail__track kpi-rail__track--auto',
          prefs.kpiLayout === 'dense' && '[&_.metric-tile]:py-2.5',
        )}
      >
        {children}
      </div>
    </div>
  )
}
