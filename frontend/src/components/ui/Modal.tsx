import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Lightweight dialog — Escape + backdrop close. TeleScope-style header band. */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
  size = 'md',
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const width =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrp-modal-title"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl',
          width,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted/30 px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="qrp-modal-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-ghost grid size-9 shrink-0 place-items-center p-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/80 bg-muted/20 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
