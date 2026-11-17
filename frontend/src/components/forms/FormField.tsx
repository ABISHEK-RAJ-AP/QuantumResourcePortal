import type { ReactNode } from 'react'

import { FieldAlert } from '@/components/auth/FormAlerts'
import { cn } from '@/lib/utils'

/** Label + control + inline validation message for workspace forms. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block text-sm font-medium', className)} htmlFor={htmlFor}>
      <span className="text-foreground">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
      <FieldAlert message={error} />
    </label>
  )
}

export function fieldErrorClass(hasError: boolean) {
  return hasError ? 'border-critical ring-2 ring-critical/20' : ''
}