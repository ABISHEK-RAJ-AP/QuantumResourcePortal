import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Lightweight dialog — Escape + backdrop close + basic focus trap. */
export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => !n.hidden)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      returnFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={cn(
          'flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card p-4 shadow-xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qrp-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="qrp-modal-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            className="btn-ghost grid size-9 place-items-center p-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}