import type { ReactNode } from 'react'

import { IntroSceneBackground } from '@/components/cert-studio/IntroSceneBackground'
import { PublicShell } from '@/components/marketing/PublicShell'
import '@/pages/public/loadCertLandingStyles'

/** Q-TeleScope `register-studio` shell — wide cert panel over intro scene (QRP theme). */
export function AuthRegisterStudio({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <PublicShell className="landing-page auth-shell auth-shell--register-studio public-auth-page">
      <IntroSceneBackground />
      <div className="reg-auth-main">
        <div className="reg-cert-panel" id="qrp-register-studio">
          {children}
          {footer ? <div className="reg-cert-footer">{footer}</div> : null}
        </div>
      </div>
    </PublicShell>
  )
}