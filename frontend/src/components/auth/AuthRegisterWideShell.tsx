import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { AuthBackdropProvider, useAuthBackdrop } from '@/components/auth/authBackdrop'
import { IntroSceneBackground } from '@/components/cert-studio/IntroSceneBackground'
import { LoginWireBackdrop } from '@/components/cert-studio/LoginWireBackdrop'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import '@/pages/public/loadCertLandingStyles'

export function AuthRegisterWideShell({ children }: { children: ReactNode }) {
  return (
    <AuthBackdropProvider>
      <AuthRegisterWideInner>{children}</AuthRegisterWideInner>
    </AuthBackdropProvider>
  )
}

function AuthRegisterWideInner({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { fields } = useAuthBackdrop()

  return (
    <PublicShell className="landing-page public-auth-page qrp-register-flow">
      <IntroSceneBackground />
      <main id="main-content" tabIndex={-1} className="qrp-register-flow__main outline-none">
        <LoginWireBackdrop
          variant={isDark ? 'dark' : 'light'}
          email={fields.username}
          password={fields.password}
          captchaInput={fields.captchaInput}
          captchaCode={fields.captchaCode}
        />
        <Link to="/login" className="qrp-register-flow__back">
          ← Back to sign in
        </Link>
        <div className="qrp-register-flow__panel">{children}</div>
      </main>
    </PublicShell>
  )
}