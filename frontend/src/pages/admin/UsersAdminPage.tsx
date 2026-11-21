/**
 * Access hub (Cert Studio pattern): Users · Roles · Permissions catalogue.
 */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, Shield, Users } from 'lucide-react'

import { AccessCataloguePanel } from '@/components/admin/AccessCataloguePanel'
import { AccessRoleMatrix } from '@/components/admin/AccessRoleMatrix'
import { AccessRolesPanel } from '@/components/admin/AccessRolesPanel'
import { AccessUsersPanel } from '@/components/admin/AccessUsersPanel'
import { PermissionGate } from '@/auth/PermissionGate'
import { useAuth } from '@/auth/hooks'
import { Card, Page, RelatedNav } from '@/components/layout/Page'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { cn } from '@/lib/utils'

import '@/styles/access-workspace.css'

type AccessTab = 'users' | 'roles' | 'catalogue'

const TABS: { id: AccessTab; label: string; icon: typeof Users; perm?: string }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield, perm: 'role:read' },
  { id: 'catalogue', label: 'Permissions', icon: BookOpen, perm: 'permission:read' },
]

function tabFromParam(raw: string | null): AccessTab {
  if (raw === 'roles' || raw === 'catalogue') return raw
  return 'users'
}

export function UsersAdminPage() {
  const { permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = tabFromParam(searchParams.get('tab'))

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.perm || permissions.has(t.perm)),
    [permissions],
  )

  const setTab = (id: AccessTab) => {
    const params = new URLSearchParams(searchParams)
    if (id === 'users') params.delete('tab')
    else params.set('tab', id)
    setSearchParams(params, { replace: true })
  }

  return (
    <Page
      crumbs={[
        { label: 'Organization', to: '/qrp/organization' },
        { label: 'People & access' },
      ]}
      title="People & access"
      {...opsPageGuidance.adminPeople}
    >
      <div className="qrp-access qrp-settings">
        <div className="qrp-settings__shell">
          <aside className="qrp-settings__sidebar max-md:w-full">
            <Card className="p-1">
              <nav className="qrp-settings__nav" aria-label="Access sections">
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
            {tab === 'users' ? (
              <>
                <PermissionGate permission="role:read">
                  <AccessRoleMatrix />
                </PermissionGate>
                <AccessUsersPanel />
              </>
            ) : null}
            {tab === 'roles' ? (
              <PermissionGate permission="role:read">
                <AccessRolesPanel />
              </PermissionGate>
            ) : null}
            {tab === 'catalogue' ? (
              <PermissionGate permission="permission:read">
                <AccessCataloguePanel />
              </PermissionGate>
            ) : null}
          </div>
        </div>
      </div>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization hub' },
          { to: '/qrp/audit', label: 'Audit trail' },
          { to: '/qrp/settings', label: 'Settings' },
          { to: '/qrp/profile', label: 'My profile' },
        ]}
      />
    </Page>
  )
}