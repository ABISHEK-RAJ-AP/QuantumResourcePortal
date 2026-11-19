import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { PublicShell } from '@/components/marketing/PublicShell'

/** Auth layout — two-column grid (Q-TeleScope auth shell pattern). */
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
  return (
    <PublicShell>
      <div className="qrp-auth-shell qrp-auth-shell--flat relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="qrp-auth-panel auth-panel-rise w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-raised">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <aside className="qrp-auth-brand flex flex-col gap-4 border-b border-white/10 p-6 text-white sm:p-8 lg:col-span-5 lg:min-h-[32rem] lg:border-b-0 lg:border-e lg:border-white/10">
              <div className="flex items-center gap-3">
                <LogoMark className="h-10 w-auto brightness-0 invert" />
                <div>
                  <p className="text-base font-semibold tracking-tight">C-DAC</p>
                  <p className="text-sm text-white/70">Quantum Resource Portal</p>
                </div>
              </div>
              <div className="qrp-auth-visual relative hidden min-h-[220px] flex-1 overflow-hidden lg:block">
                <AuthFridgeVisual />
              </div>
              <div className="mt-auto space-y-2">
                <h2 className="type-section-title text-white type-title-clamp">Quantum Resource Portal</h2>
                <p className="hyphenate max-w-[40ch] text-sm leading-relaxed text-white/60 text-pretty">
                  Sign in to your organization workspace — approvals, quotas, dispatch, and audit exports.
                </p>
                <Link to="/" className="fs-link inline-flex min-h-10 items-center text-sm font-medium text-cyan-300/90 hover:text-cyan-200">
                  ← Back to home
                </Link>
              </div>
            </aside>
            <main id="main-content" className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7">
              <div className="mx-auto w-full max-w-md space-y-6">
                <header>
                  <h1 className="type-page-title type-trim text-balance">{title}</h1>
                  {subtitle ? (
                    <p className="qrp-page-desc hyphenate mt-2 text-base">{subtitle}</p>
                  ) : null}
                </header>
                {children}
                {footer ? <div className="qrp-auth-form-footer auth-panel-footer border-t border-border pt-3">{footer}</div> : null}
              </div>
            </main>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}

/** Auth-only links — Privacy/Terms live in site footer (Q-TeleScope pattern). */
export function AuthFooterLinks({
  showForgot = false,
  showRegister = false,
  showHome = true,
}: {
  showForgot?: boolean
  showRegister?: boolean
  showHome?: boolean
}) {
  const links: ReactNode[] = []
  if (showForgot) {
    links.push(
      <Link key="forgot" className="fs-link font-semibold text-primary" to="/forgot-password">
        Forgot password
      </Link>,
    )
  }
  if (showRegister) {
    links.push(
      <Link key="register" className="fs-link font-semibold text-primary" to="/register">
        Register organization
      </Link>,
    )
  }
  if (showHome) {
    links.push(
      <Link key="home" className="fs-link font-semibold text-primary" to="/">
        Home
      </Link>,
    )
  }

  if (!links.length) return null

  return (
    <p className="auth-panel-footer__links text-sm text-muted-foreground">
      {links.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {node}
        </span>
      ))}
    </p>
  )
}