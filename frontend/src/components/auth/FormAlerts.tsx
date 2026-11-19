import { useEffect, useRef, type ReactNode } from 'react'
import type { FieldError } from '@/api/client'
import { cn } from '@/lib/utils'

/** Inline field message — under the control, not a toast. */
export function FieldAlert({
  id,
  message,
  className,
}: {
  id?: string
  message?: string | null
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!message || !ref.current) return
    ref.current.classList.remove('qrp-shake')
    void ref.current.offsetWidth
    ref.current.classList.add('qrp-shake')
  }, [message])
  if (!message) return null
  return (
    <p id={id} ref={ref} role="alert" className={cn('mt-1 text-sm text-critical', className)}>
      {message}
    </p>
  )
}

/** Form-level banner for non-field failures (network, auth denied). */
export function FormBanner({
  message,
  tone = 'critical',
  className,
}: {
  message?: string | null
  tone?: 'critical' | 'warning' | 'success'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!message || !ref.current) return
    ref.current.classList.remove('qrp-shake')
    void ref.current.offsetWidth
    ref.current.classList.add('qrp-shake')
  }, [message])
  if (!message) return null
  const shell =
    tone === 'success'
      ? 'border-success/30 bg-success-soft text-success-text'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning-soft text-warning-text'
        : 'border-critical/30 bg-critical-soft text-critical-text'
  return (
    <div ref={ref} role="alert" className={cn('rounded-[var(--radius-inner)] border px-3 py-2 text-sm', shell, className)}>
      {message}
    </div>
  )
}

export function fieldMessage(errors: FieldError[] | undefined, field: string) {
  return errors?.find((e) => e.field === field)?.message
}

export function mapApiFieldErrors(errors: FieldError[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of errors ?? []) {
    if (e.field && e.message) out[e.field] = e.message
  }
  return out
}

export function FormShakeShell({
  shakeKey,
  className,
  children,
}: {
  shakeKey?: string | null
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!shakeKey || !ref.current) return
    ref.current.classList.remove('qrp-shake')
    void ref.current.offsetWidth
    ref.current.classList.add('qrp-shake')
  }, [shakeKey])
  return (
    <div ref={ref} className={cn('qrp-form-shell', className)}>
      {children}
    </div>
  )
}