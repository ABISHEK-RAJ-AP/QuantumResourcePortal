import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { cn } from '@/lib/utils'

/**
 * Request-access page (RBAC-6, decision R-06). Self-service registration with a self-chosen role is
 * a privilege-escalation path, so it is disabled by default; accounts are created by a platform
 * administrator, who also assigns roles. If self-registration is later enabled for a deployment,
 * this page is where the (role-less, PENDING) sign-up form would live.
 */
export function RegisterPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <PublicShell>
      <div className="relative flex-1">
        <CyberMatrixHero showDefaultContent={false} className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}>
          <div className="fade-up auth-panel-rise mx-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-8 text-foreground shadow-raised backdrop-blur-md">
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className="text-xs text-muted-foreground">Quantum Resource Portal</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Request access</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Accounts are created by a platform administrator, who assigns your roles. Self-service
              sign-up is disabled on this deployment. Contact your administrator to be added, then sign
              in with the credentials they provide.
            </p>
            <Link className="btn-primary mt-6 inline-flex w-full justify-center py-2.5" to="/login">
              Back to sign in
            </Link>
          </div>
        </CyberMatrixHero>
      </div>
    </PublicShell>
  )
}
