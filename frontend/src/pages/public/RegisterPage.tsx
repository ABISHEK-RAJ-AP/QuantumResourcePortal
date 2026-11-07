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
          <div
            className={cn(
              'fade-up auth-panel-rise mx-auto w-full max-w-md rounded-2xl border p-8 shadow-raised backdrop-blur-md',
              dark ? 'border-white/15 bg-black/75 text-white' : 'border-border bg-card/95 text-foreground',
            )}
          >
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className={cn('text-xs', dark ? 'text-white/55' : 'text-muted-foreground')}>
                  Quantum Resource Portal
                </p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Request access</h2>
            <p className={cn('mt-2 text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>
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
