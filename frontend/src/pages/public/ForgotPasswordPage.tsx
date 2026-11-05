import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { authFetch } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export function ForgotPasswordPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [devToken, setDevToken] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setDevToken('')
    try {
      const res = await authFetch<{ message?: string; dev_reset_token?: string }>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      })
      setMessage(res.message || 'If that account exists, a reset was issued.')
      if (res.dev_reset_token) setDevToken(res.dev_reset_token)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Request failed')
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
            <h2 className="text-xl font-semibold tracking-tight">Forgot password</h2>
            <p className={cn('mt-1 text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              Enter username. Reset token is issued only if the account exists.
            </p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                Username
                <input
                  required
                  autoComplete="username"
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              {message ? <p className="text-sm">{message}</p> : null}
              {devToken ? (
                <p className={cn('break-all text-xs', dark ? 'text-white/55' : 'text-muted-foreground')}>
                  Lab token:{' '}
                  <Link className="font-medium text-primary hover:underline" to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                    continue
                  </Link>
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Requesting…' : 'Request reset'}
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
