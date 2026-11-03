import { useCallback, useRef, type MouseEvent } from 'react'

import { cn } from '@/lib/utils'

/** Interactive CSS grid — tiles brighten under the cursor (theme-aware). */
export function HoverGrid({ className, density = 48 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const root = ref.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    root.style.setProperty('--hx', `${x}%`)
    root.style.setProperty('--hy', `${y}%`)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      onMouseMove={onMove}
      className={cn('hover-grid pointer-events-auto', className)}
      style={{
        backgroundSize: `${density}px ${density}px`,
      }}
    />
  )
}
