import type { ReactNode } from 'react'

import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { cn } from '@/lib/utils'

/** KPI / metric strip that respects workspace layout prefs. */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  const prefs = useWorkspacePrefs()
  if (prefs.kpiLayout === 'hidden') return null
  return (
    <div
      className={cn(
        'grid gap-3',
        prefs.kpiLayout === 'dense' ? 'sm:grid-cols-3 xl:grid-cols-6' : 'sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
