import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Interruptible enter — opacity/transform via transition, retargets if route changes mid-flight. */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(false)
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return <div className={cn('page-enter', on && 'is-in', className)}>{children}</div>
}
