import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

/** Self-service reset lands in a later identity slice; lab users ask a platform admin. */
export function ForgotPasswordPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <PublicShell>
      <div className="relative flex-1">
        <CyberMatrixHero showDefaultContent={false} className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}>
          <div
            className={cn(
              'fade-up mx-auto w-full max-w-md rounded-2xl border p-8 shadow-raised backdrop-blur-md',
              dark ? 'border-white/15 bg-black/75 text-white' : 'border-border bg-card/95 text-foreground',
            )}
          >
            <BrandHeader dark={dark} />
            <h2 className="text-xl font-semibold tracking-tight">Password reset</h2>
            <p className={cn('mt-2 text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              QRP uses its own identity service. Self-service email reset is not enabled in this build. Contact a
              platform administrator or use the Users screen after sign-in.
            </p>
            <p className={cn('mt-4 text-center text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              <Link className="font-medium text-primary hover:underline" to="/login">
                Back to sign in
              </Link>
            </p>
          </div>
        </CyberMatrixHero>
      </div>
    </PublicShell>
  )
}

function BrandHeader({ dark }: { dark: boolean }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
      <p className="text-sm font-semibold">C-DAC</p>
    </div>
  )
}
