import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/hooks'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const from = (location.state as { from?: string } | null)?.from || '/qrp'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate(from.startsWith('/') ? from : '/qrp', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="relative flex-1">
        <CyberMatrixHero
          showDefaultContent={false}
          className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}
        >
          <div className="fade-up auth-panel-rise mx-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-8 text-foreground shadow-raised backdrop-blur-md">
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className="text-xs text-muted-foreground">Sign in to Quantum Resource Portal</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your portal credentials.</p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                Username
                <input
                  required
                  autoComplete="username"
                  className="field-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  className="field-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <p className="text-sm text-critical">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Need an account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/register">
                Request access
              </Link>
              {' · '}
              <Link className="font-medium text-primary hover:underline" to="/">
                Home
              </Link>
            </p>
          </div>
        </CyberMatrixHero>
      </div>
    </PublicShell>
  )
}
