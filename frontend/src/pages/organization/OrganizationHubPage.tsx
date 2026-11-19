/**
 * Organisation workspace (Cert Studio `/settings/organisation/*` pattern).
 */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Building2, Mail, UserPlus, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { qre } from '@/api/qre'
import { useAuth } from '@/auth/hooks'
import { PermissionGate } from '@/auth/PermissionGate'
import { Card, Page, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { cn } from '@/lib/utils'

import '@/styles/settings-workspace.css'
import '@/styles/org-studio.css'

type OrgTab = 'overview' | 'people' | 'invitations'

const TABS: { id: OrgTab; label: string; icon: typeof Building2 }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'people', label: 'People', icon: Users },
  { id: 'invitations', label: 'Invitations', icon: Mail },
]

function tabFromParam(raw: string | null): OrgTab {
  if (raw === 'people' || raw === 'invitations') return raw
  return 'overview'
}

export function OrganizationHubPage() {
  const { user, permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = tabFromParam(searchParams.get('tab'))
  const orgQuery = useQuery({
    queryKey: ['me-organization'],
    queryFn: () => qre<Record<string, unknown>>('/me/organization'),
    enabled: Boolean(user),
  })
  const org = orgQuery.data ?? {}
  const canAdmin = permissions.has('membership:admin') || permissions.has('user:read')

  const setTab = (id: OrgTab) => {
    const params = new URLSearchParams(searchParams)
    if (id === 'overview') params.delete('tab')
    else params.set('tab', id)
    setSearchParams(params, { replace: true })
  }

  const displayName = useMemo(
    () => String(org.name || user?.tenant_name || 'Your organization'),
    [org.name, user?.tenant_name],
  )

  return (
    <Page
      crumbs={[
        { label: 'Workspace', to: '/qrp' },
        { label: 'Organization' },
      ]}
      title="Organization"
      description="Customer tenant on the CDAC platform — identity, people, projects, and consumption (Cert Studio Organisation hub)."
    >
      <div className="qrp-settings">
        <div className="qrp-settings__shell">
          <aside className="qrp-settings__sidebar max-md:w-full">
            <Card className="qrp-settings__identity craft-card">
              <div className="qrp-settings__avatar" aria-hidden>
                <Building2 className="size-5" />
              </div>
              <p className="qrp-settings__name">{displayName}</p>
              <p className="qrp-settings__meta font-mono text-xs">{String(org.code || user?.tenant_code || '—')}</p>
              <StatusBadge
                tone={String(org.status || 'ACTIVE') === 'ACTIVE' ? 'success' : 'warning'}
                label={String(org.status || 'ACTIVE')}
              />
            </Card>
            <Card className="p-1">
              <nav className="qrp-settings__nav" aria-label="Organization sections">
                {TABS.map(({ id, label, icon: Icon }) => (
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

          <div className="org-section-stack min-w-0">
            {tab === 'overview' ? (
              <section className="org-section-card org-glass">
                <header className="org-section-card__head">
                  <h2 className="org-section-card__title">Organization identity</h2>
                  <p className="org-section-card__lead">
                    Core profile for this customer workspace. CDAC operates the shared platform; your org owns members,
                    projects, and consumption.
                  </p>
                </header>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Display name</dt>
                    <dd className="mt-1 font-medium">{displayName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Code</dt>
                    <dd className="mt-1 font-mono text-xs">{String(org.code || user?.tenant_code || '—')}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-muted-foreground">Technical id</dt>
                    <dd className="mt-1 font-mono text-xs break-all">{String(org.tenant_id || user?.tenant_id || '—')}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Link className="btn-ghost text-sm" to="/qrp/quotas">
                    Organization quotas
                  </Link>
                  <Link className="btn-ghost text-sm" to="/qrp/metering">
                    Usage metering
                  </Link>
                  <Link className="btn-ghost text-sm" to="/qrp/projects">
                    Research projects
                  </Link>
                </div>
              </section>
            ) : null}

            {tab === 'people' ? (
              <section className="org-section-card org-glass space-y-4 text-sm">
                <header className="org-section-card__head">
                  <h2 className="org-section-card__title">People &amp; access</h2>
                  <p className="org-section-card__lead">
                    Directory, role assignments, and the permission catalogue — same hub as Cert Studio Organisation →
                    People.
                  </p>
                </header>
                {canAdmin ? (
                  <Link className="btn-primary inline-flex items-center gap-2 text-sm" to="/qrp/admin/users">
                    <Users className="size-4" aria-hidden />
                    Open access workspace
                  </Link>
                ) : (
                  <p className="text-muted-foreground">
                    You do not administer memberships. Contact your organization administrator to be invited.
                  </p>
                )}
              </section>
            ) : null}

            {tab === 'invitations' ? (
              <section className="org-section-card org-glass space-y-4 text-sm">
                <header className="org-section-card__head">
                  <h2 className="org-section-card__title">Invitations</h2>
                  <p className="org-section-card__lead">
                    Email invites and join requests arrive in a later phase. Today, administrators create accounts in
                    People.
                  </p>
                </header>
                <PermissionGate permission="membership:admin">
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                    <UserPlus className="mx-auto size-8 text-muted-foreground opacity-70" aria-hidden />
                    <p className="mt-3 font-medium">Invite flow not enabled</p>
                    <p className="mt-1 text-muted-foreground">
                      Add members under{' '}
                      <Link className="font-medium text-primary hover:underline" to="/qrp/admin/users">
                        People &amp; access
                      </Link>{' '}
                      (create user, then grant a role).
                    </p>
                  </div>
                </PermissionGate>
                {!canAdmin ? (
                  <p className="text-muted-foreground">Only organization administrators manage invitations.</p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>
      <RelatedNav
        items={[
          { to: '/qrp/admin/users', label: 'People & access' },
          { to: '/qrp/quotas', label: 'Quotas' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/settings', label: 'Settings' },
        ]}
      />
    </Page>
  )
}