import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qre } from '@/api/qre'
import { Card, PanelHeader } from '@/components/layout/Page'
import { InfoTip } from '@/components/ui/InfoTip'
import { message } from '@/pages/workspace/screens'

type MfaStatus = { enabled?: boolean }
type EnrollStart = { secret?: string; otpauth_url?: string }
type EnrollConfirm = { enabled?: boolean; backup_codes?: string[] }
type SessionRow = { id?: string; created_at?: string; current?: boolean; user_agent?: string }

export function AccountSecurity() {
  const client = useQueryClient()
  const mfa = useQuery({
    queryKey: ['me-mfa'],
    queryFn: () => qre<MfaStatus>('/users/me/mfa/status'),
  })
  const sessions = useQuery({
    queryKey: ['me-sessions'],
    queryFn: () => qre<{ sessions?: SessionRow[] }>('/users/me/sessions'),
  })
  const [code, setCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [backups, setBackups] = useState<string[]>([])
  const [secret, setSecret] = useState('')
  const [otpauth, setOtpauth] = useState('')

  const start = useMutation({
    mutationFn: () => qre<EnrollStart>('/users/me/mfa/enroll/start', { method: 'POST' }),
    onSuccess: (row) => {
      setSecret(row.secret || '')
      setOtpauth(row.otpauth_url || '')
      setBackups([])
    },
  })
  const confirmMfa = useMutation({
    mutationFn: () => qre<EnrollConfirm>('/users/me/mfa/enroll/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: (row) => {
      setBackups(row.backup_codes || [])
      setCode('')
      void client.invalidateQueries({ queryKey: ['me-mfa'] })
    },
  })
  const disable = useMutation({
    mutationFn: () => qre('/users/me/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: () => {
      setCode('')
      setSecret('')
      setOtpauth('')
      setBackups([])
      void client.invalidateQueries({ queryKey: ['me-mfa'] })
    },
  })
  const password = useMutation({
    mutationFn: () =>
      qre('/users/me/password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirm,
        }),
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    },
  })
  const revokeOthers = useMutation({
    mutationFn: () => qre('/users/me/sessions/revoke-others', { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['me-sessions'] }),
  })

  const enabled = Boolean(mfa.data?.enabled)
  const rows = sessions.data?.sessions ?? []

  return (
    <>
      <Card className="space-y-3 text-sm">
        <PanelHeader
          title="Authenticator (MFA)"
          action={
            <InfoTip label="MFA help">
              Time-based codes from an authenticator app. Enrollment uses TeleScope /users/me/mfa.
            </InfoTip>
          }
        />
        <p>
          Status:{' '}
          <span className="font-medium">{mfa.isError ? message(mfa.error) : enabled ? 'On' : 'Off'}</span>
        </p>
        {!enabled ? (
          <div className="space-y-2">
            <button type="button" className="btn-secondary" disabled={start.isPending} onClick={() => start.mutate()}>
              {start.isPending ? 'Starting…' : 'Start enrollment'}
            </button>
            {secret ? (
              <p className="break-all font-mono text-xs">
                Secret {secret}
                {otpauth ? (
                  <>
                    {' · '}
                    <a className="text-primary hover:underline" href={otpauth}>
                      otpauth link
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            {secret ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  confirmMfa.mutate()
                }}
              >
                <label className="text-xs">
                  App code
                  <input className="field-input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required />
                </label>
                <button type="submit" className="btn-primary" disabled={confirmMfa.isPending}>
                  Confirm
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              disable.mutate()
            }}
          >
            <label className="text-xs">
              Code to disable
              <input className="field-input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <button type="submit" className="btn-secondary" disabled={disable.isPending}>
              Disable MFA
            </button>
          </form>
        )}
        {backups.length > 0 ? (
          <p className="break-all font-mono text-xs">Backup codes: {backups.join(' ')}</p>
        ) : null}
        {start.error || confirmMfa.error || disable.error ? (
          <p className="text-critical">{message(start.error || confirmMfa.error || disable.error)}</p>
        ) : null}
      </Card>

      <Card className="space-y-3 text-sm">
        <PanelHeader title="Change password" />
        <form
          className="grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            password.mutate()
          }}
        >
          <label className="text-xs">
            Current
            <input
              type="password"
              className="field-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="text-xs">
            New
            <input
              type="password"
              minLength={6}
              className="field-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label className="text-xs">
            Confirm
            <input
              type="password"
              minLength={6}
              className="field-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={password.isPending}>
              {password.isPending ? 'Updating…' : 'Update password'}
            </button>
            {password.error ? <p className="mt-2 text-critical">{message(password.error)}</p> : null}
            {password.isSuccess ? <p className="mt-2">Password updated. Other sessions signed out.</p> : null}
          </div>
        </form>
      </Card>

      <Card className="space-y-3 text-sm">
        <PanelHeader
          title="Sessions"
          action={
            <button type="button" className="btn-ghost text-xs" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
              Revoke others
            </button>
          }
        />
        {sessions.isError ? (
          <p className="text-muted-foreground">{message(sessions.error)}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">No session list from API.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {rows.map((row, i) => (
              <li key={String(row.id || i)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate font-mono text-xs" title={row.user_agent || ''}>
                  {row.id || 'session'}
                </span>
                <span className="text-xs text-muted-foreground">{row.current ? 'This device' : row.created_at || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
