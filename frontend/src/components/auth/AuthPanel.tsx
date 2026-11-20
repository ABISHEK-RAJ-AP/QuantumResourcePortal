import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { AuthBackdropProvider, useAuthBackdrop } from '@/components/auth/authBackdrop'
import { IntroSceneBackground } from '@/components/cert-studio/IntroSceneBackground'
import { LoginWireBackdrop } from '@/components/cert-studio/LoginWireBackdrop'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import { MarketingContainer } from '@/components/ui/MarketingContainer'
import '@/pages/public/loadCertLandingStyles'

/** Cert Studio auth shell — intro scene + form-driven wire + centred glass card. */
export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <AuthBackdropProvider>
      <AuthPanelInner title={title} subtitle={subtitle} footer={footer} wide={wide}>
        {children}
      </AuthPanelInner>
    </AuthBackdropProvider>
  )
}

function AuthPanelInner({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { fields } = useAuthBackdrop()
  const cardClass = wide ? 'cert-register-card' : 'cert-login-card'

  return (
    <PublicShell
      className={`landing-page public-auth-page cert-auth-page--intro${wide ? ' public-auth-page--wide' : ''}`}
    >
      <IntroSceneBackground />
      <main id="main-content" tabIndex={-1} className="cert-auth-page__main outline-none">
        <LoginWireBackdrop
          variant={isDark ? 'dark' : 'light'}
          email={fields.username}
          password={fields.password}
          captchaInput={fields.captchaInput}
          captchaCode={fields.captchaCode}
        />
        <MarketingContainer
          narrow
          className="cert-auth-page__container"
          style={{ maxWidth: wide ? 540 : 460 }}
        >
          <div className={`qrp-auth-shell ${cardClass}`}>
            <div className="cert-auth-card__brand">
              <div className="cert-login-card__logo-wrap">
                <LogoMark className="h-14 w-auto max-w-[140px]" aria-hidden />
              </div>
              <p className="cert-auth-card__wordmark">Quantum Resource Portal</p>
            </div>
            <header className="cert-login-card__head">
              <h1>{title}</h1>
              {subtitle ? <p className="cert-login-card__subtitle">{subtitle}</p> : null}
            </header>
            {children}
            {footer ? (
              <div className="cert-auth-card__footer qrp-auth-form-footer auth-panel-footer">{footer}</div>
            ) : null}
            <Link to="/" className="cert-auth-inline-back">
              ← Back to home
            </Link>
          </div>
        </MarketingContainer>
      </main>
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
    <p className="auth-panel-footer__links text-center text-sm text-muted-foreground">
      {links.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {node}
        </span>
      ))}
    </p>
  )
}