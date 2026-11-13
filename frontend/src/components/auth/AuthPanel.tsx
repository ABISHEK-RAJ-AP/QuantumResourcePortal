import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

/** Shared auth card layout — login / MFA / reset / forgot / register. */
export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <PublicShell>
      <div
        className={cn(
          'auth-panel-rise flex flex-1 items-center justify-center px-4 py-12',
          dark ? 'bg-background' : 'bg-surface',
        )}
      >
        <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-8 text-foreground shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
            <div>
              <p className="text-sm font-semibold">C-DAC</p>
              <p className="text-xs text-muted-foreground">Quantum Resource Portal</p>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-balance">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </PublicShell>
  )
}

export function AuthFooterLinks({
  showForgot = false,
  showRegister = false,
}: {
  showForgot?: boolean
  showRegister?: boolean
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      {showForgot ? (
        <Link className="font-medium text-primary hover:underline" to="/forgot-password">
          Forgot password
        </Link>
      ) : null}
      {showForgot && showRegister ? <span aria-hidden>·</span> : null}
      {showRegister ? (
        <Link className="font-medium text-primary hover:underline" to="/register">
          Request access
        </Link>
      ) : null}
      <span aria-hidden>·</span>
      <Link className="font-medium text-primary hover:underline" to="/">
        Home
      </Link>
    </p>
  )
}
