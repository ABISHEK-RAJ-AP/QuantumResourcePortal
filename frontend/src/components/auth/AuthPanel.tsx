import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { cn } from '@/lib/utils'

/** Shared auth card layout — same structure for login / MFA / reset / forgot / register. */
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
      <div className="relative flex-1">
        <CyberMatrixHero
          showDefaultContent={false}
          className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}
        >
          <div className="auth-panel-rise mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-foreground shadow-raised">
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className="text-xs text-muted-foreground">Quantum Resource Portal</p>
              </div>
            </div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </CyberMatrixHero>
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
