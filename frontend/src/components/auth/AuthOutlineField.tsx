import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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

export function AuthFieldHint({ children }: { children: ReactNode }) {
  return <p className="cert-auth-field-hint">{children}</p>
}

/** Outlined password with Q-TeleScope / Cert Studio reveal control. */
export function AuthPasswordField({
  label,
  htmlFor,
  value,
  onChange,
  autoComplete,
  invalid,
  id,
}: {
  label: string
  htmlFor: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  invalid?: boolean
  id?: string
}) {
  const [show, setShow] = useState(false)
  const inputId = id ?? htmlFor
  return (
    <AuthOutlineField label={label} htmlFor={htmlFor} className="cert-login-password-field">
      <input
        id={inputId}
        required
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={authOutlineControlClass}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="cert-login-password-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </AuthOutlineField>
  )
}