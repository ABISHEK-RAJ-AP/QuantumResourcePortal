import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Building2, FlaskConical, LayoutGrid, LogOut, Shield, User } from 'lucide-react'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { qre } from '@/api/qre'
import { useAuth } from '@/auth/hooks'
import { DemoEnvironmentPanel } from '@/components/shell/DemoEnvironmentPanel'
import { WorkspaceLayoutPrefsPanel } from '@/components/shell/WorkspaceLayoutPrefsPanel'
import { Card, Page, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { demoActionsAllowed } from '@/lib/demo'
import { formatPrincipalId, formatRole } from '@/lib/display'
import { cn } from '@/lib/utils'

import '@/styles/settings-workspace.css'

type SettingsTab = 'account' | 'organization' | 'security' | 'workspace' | 'lab'

const TABS: { id: SettingsTab; label: string; icon: typeof User; show?: 'lab' }[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
  { id: 'lab', label: 'Lab', icon: FlaskConical, show: 'lab' },
]

function initials(principalId: string | null | undefined) {
  const slug = String(principalId ?? '').replace(/^user:/i, '').trim()
  if (slug.length >= 2) return slug.slice(0, 2).toUpperCase()
  return 'U'
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout, permissions } = useAuth()
  const [tab, setTab] = useState<SettingsTab>('account')
  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities, staleTime: 60_000 })
  const boundary = useQuery({
    queryKey: ['institution-boundary'],
    queryFn: () => qre<Record<string, unknown>>('/governance/institution-boundary'),
    retry: false,
  })

  const visibleTabs = useMemo(
    () => TABS.filter((t) => (t.show === 'lab' ? demoActionsAllowed : true)),
    [],
  )

  const canAdminUsers = permissions.has('user:read')

  if (!user) {
    return (
      <Page crumbs={[{ label: 'Admin' }, { label: 'Settings' }]} title="Settings" description="Sign in to manage your account.">
        <Card className="text-sm text-muted-foreground">No active session.</Card>
      </Page>
    )
  }

  const display = formatPrincipalId(user.principal_id, user.roles[0])
  const role = user.roles.map((r) => formatRole(r)).join(', ')
  const fed = (boundary.data?.federation as Record<string, unknown> | undefined) ?? {}
  const siteName = fed.local_site_name ? String(fed.local_site_name) : null

  return (
    <Page
      crumbs={[{ label: 'Admin' }, { label: 'Settings' }]}
      title="Settings"
      description="Personal account and device preferences for your signed-in user — organization profile and people live under Organization."
    >
      <div className="qrp-settings">
        <div className="qrp-settings__shell">
          <aside className="qrp-settings__sidebar">
            <Card className="qrp-settings__identity craft-card">
              <div className="qrp-settings__avatar" aria-hidden>
                {initials(user.principal_id)}
              </div>
              <p className="qrp-settings__name">{display}</p>
              <p className="qrp-settings__meta">{user.tenant_name || user.tenant_code || user.tenant_id}</p>
              {siteName ? <p className="qrp-settings__meta">{siteName}</p> : null}
              <span className="qrp-settings__role">{role || 'Member'}</span>
            </Card>

            <Card className="p-1">
              <nav className="qrp-settings__nav" aria-label="Settings sections">
                {visibleTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn('qrp-settings__nav-btn', tab === id && 'is-active')}
                    aria-current={tab === id ? 'page' : undefined}
                    onClick={() => setTab(id)}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                    {label}
                  </button>
                ))}
              </nav>
            </Card>
          </aside>

          <div className="min-w-0 space-y-4">
            {tab === 'account' ? (
              <Card>
                <header className="qrp-settings__card-head">
                  <h2 className="qrp-settings__card-title">Account</h2>
                  <p className="qrp-settings__card-desc">
                    Your user identity inside <span className="font-medium text-foreground">{user.tenant_name || user.tenant_code || 'the active organization'}</span>.
                  </p>
                </header>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Signed in as</dt>
                    <dd className="mt-1 font-medium">{display}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Role</dt>
                    <dd className="mt-1 font-medium">{role}</dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-border pt-4 text-sm">
                  <Link className="font-medium text-primary hover:underline" to="/qrp/profile">
                    View roles and permissions
                  </Link>
                </p>
              </Card>
            ) : null}

            {tab === 'organization' ? (
              <Card className="space-y-4 text-sm">
                <header className="qrp-settings__card-head">
                  <h2 className="qrp-settings__card-title">Organization</h2>
                  <p className="qrp-settings__card-desc">
                    Cert Studio–style hub for identity, people, and invitations — separate from personal account
                    settings.
                  </p>
                </header>
                <p className="text-muted-foreground">
                  Active workspace: <span className="font-medium text-foreground">{user.tenant_name || user.tenant_code}</span>
                </p>
                <Link className="btn-primary text-sm" to="/qrp/organization">
                  Open organization hub
                </Link>
              </Card>
            ) : null}

            {tab === 'security' ? (
              <Card>
                <header className="qrp-settings__card-head">
                  <h2 className="qrp-settings__card-title">Security</h2>
                  <p className="qrp-settings__card-desc">How you sign in and what the deployment allows on this profile.</p>
                </header>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Multi-factor</dt>
                    <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={caps.data?.mfa_verification_available ? 'success' : 'neutral'}
                        label={caps.data?.mfa_verification_available ? 'Available' : 'Not enabled'}
                      />
                      {caps.data?.mfa_required ? <StatusBadge tone="warning" label="Required by policy" /> : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Password</dt>
                    <dd className="mt-1.5">
                      <StatusBadge
                        tone={caps.data?.password_self_service ? 'success' : 'neutral'}
                        label={caps.data?.password_self_service ? 'Self-service change' : 'Admin reset only'}
                      />
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
                  {canAdminUsers ? (
                    <Link className="font-medium text-primary hover:underline" to="/qrp/admin/users">
                      People &amp; access
                    </Link>
                  ) : null}
                  <Link className="font-medium text-primary hover:underline" to="/qrp/audit">
                    Audit trail
                  </Link>
                  <Link className="font-medium text-primary hover:underline" to="/legal/privacy">
                    Privacy
                  </Link>
                  <Link className="font-medium text-primary hover:underline" to="/legal/terms">
                    Terms
                  </Link>
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-2 text-sm"
                    onClick={() => {
                      void logout()
                      navigate('/login')
                    }}
                  >
                    <LogOut className="size-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              </Card>
            ) : null}

            {tab === 'workspace' ? (
              <Card>
                <header className="qrp-settings__card-head">
                  <h2 className="qrp-settings__card-title">Workspace layout</h2>
                  <p className="qrp-settings__card-desc">Density and chart defaults for this browser only.</p>
                </header>
                <WorkspaceLayoutPrefsPanel />
              </Card>
            ) : null}

            {tab === 'lab' && demoActionsAllowed ? (
              <div>
                <DemoEnvironmentPanel />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization hub' },
          { to: '/qrp/profile', label: 'My profile' },
          { to: '/qrp/admin/users', label: 'People & access' },
          { to: '/qrp/audit', label: 'Audit trail' },
        ]}
      />
    </Page>
  )
}
