import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Compact help — replaces wall-of-text justifications. */
export function InfoTip({
  label = 'More info',
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <span ref={root} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className="absolute start-0 top-full z-40 mt-1 w-64 rounded-lg border border-border bg-card p-3 text-xs font-normal normal-case tracking-normal text-muted-foreground shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}
