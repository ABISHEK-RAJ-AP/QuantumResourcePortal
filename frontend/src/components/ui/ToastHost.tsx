import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

import {
  TOAST_DISMISS_EVENT,
  TOAST_EVENT,
  type ToastItem,
  type ToastTone,
  dismissToast,
} from '@/lib/toast'
import { cn } from '@/lib/utils'

const LIMIT = 3
const AUTO_MS = 5200

function Icon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
  if (tone === 'error') return <XCircle className="size-4 shrink-0 text-critical" aria-hidden />
  if (tone === 'warn') return <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
  return <Info className="size-4 shrink-0 text-primary" aria-hidden />
}

function toneShell(tone: ToastTone) {
  if (tone === 'success') return 'border-success/30 bg-card'
  if (tone === 'error') return 'border-critical/30 bg-card'
  if (tone === 'warn') return 'border-warning/30 bg-card'
  return 'border-border bg-card'
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<ToastItem>).detail
      if (!detail?.message) return
      setItems((prev) => {
        const without = prev.filter((t) => t.id !== detail.id)
        return [detail, ...without].slice(0, LIMIT)
      })
    }
    const onDismiss = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (!id) return
      setItems((prev) => prev.filter((t) => t.id !== id))
    }
    window.addEventListener(TOAST_EVENT, onAdd)
    window.addEventListener(TOAST_DISMISS_EVENT, onDismiss)
    return () => {
      window.removeEventListener(TOAST_EVENT, onAdd)
      window.removeEventListener(TOAST_DISMISS_EVENT, onDismiss)
    }
  }, [])

  useEffect(() => {
    if (items.length === 0) return undefined
    const timers = items.map((t) =>
      window.setTimeout(() => dismissToast(t.id), AUTO_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [items])

  if (items.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed end-4 top-[calc(var(--a11y-preheader-height,2rem)+4.75rem)] z-[90] flex w-[min(380px,calc(100vw-28px))] flex-col gap-2.5"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm',
            toneShell(t.tone),
          )}
          role="status"
        >
          <Icon tone={t.tone} />
          <p className="min-w-0 flex-1 text-sm leading-snug">{t.message}</p>
          <button
            type="button"
            className="btn-ghost grid size-7 shrink-0 place-items-center p-0"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
