import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { cn } from '@/lib/utils'

function motionReduced() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('a11y-pause-anim')
  )
}

/** Decorative CSS grid — tiles brighten under the cursor when motion is allowed. */
export function HoverGrid({ className, density = 48 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduce(motionReduced())
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const onMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (reduce) return
      const root = ref.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      root.style.setProperty('--hx', `${x}%`)
      root.style.setProperty('--hy', `${y}%`)
    },
    [reduce],
  )

  return (
    <div
      ref={ref}
      aria-hidden
      onMouseMove={reduce ? undefined : onMove}
      className={cn('hover-grid', reduce ? 'pointer-events-none' : 'pointer-events-auto', className)}
      style={{
        backgroundSize: `${density}px ${density}px`,
        ...(reduce ? { transition: 'none' } : null),
      }}
    />
  )
}
