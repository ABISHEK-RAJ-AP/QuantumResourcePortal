import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Outlined field — Q-TeleScope auth-outline pattern. */
export function AuthOutlineField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('auth-outline-field', className)}>
      <label htmlFor={htmlFor} className="auth-outline-field__name">
        {label}
      </label>
      {children}
    </div>
  )
}

export const authOutlineControlClass =
  'auth-outline-field__control w-full border-0 bg-transparent text-[1.0625rem] leading-snug outline-none'