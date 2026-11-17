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
        'grid w-full gap-2 sm:gap-3',
        'grid-cols-[repeat(auto-fit,minmax(10.75rem,1fr))]',
        prefs.kpiLayout === 'dense' && '[&_.metric-tile]:py-2.5',
        className,
      )}
      role="list"
      aria-label="Key metrics"
    >
      {children}
    </div>
  )
}
