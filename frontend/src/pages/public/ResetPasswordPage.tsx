import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { authFetch } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password, confirm_password: confirm }),
      })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

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
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <p className="text-sm font-semibold">C-DAC</p>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Set new password</h2>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                Reset token
                <input
                  required
                  className={cn('field-input font-mono text-xs', dark && 'border-white/15 bg-white/5 text-white')}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                New password
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Confirm password
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              {error ? <p className="text-sm text-critical">{error}</p> : null}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>
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
