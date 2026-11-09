import { Link } from 'react-router'

import { useAuth } from '@/auth/hooks'
import { Card, PanelHeader } from '@/components/layout/Page'

/** Password/MFA/session flows ship on the QRP identity API in later slices. */
export function AccountSecurity() {
  const { user } = useAuth()
  return (
    <Card className="space-y-2 text-sm">
      <PanelHeader title="Account" />
      {user ? (
        <>
          <p>
            Signed in as <span className="font-medium">{user.roles.join(', ') || 'member'}</span>
          </p>
          <p className="text-muted-foreground">
            Profile and RBAC admin use the QRP backend. Password reset and MFA enrolment are not on this API yet.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link className="font-medium text-primary hover:underline" to="/qrp/profile">
              Profile
            </Link>
            <Link className="font-medium text-primary hover:underline" to="/qrp/admin/users">
              Users
            </Link>
            <Link className="font-medium text-primary hover:underline" to="/qrp/admin/roles">
              Roles
            </Link>
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No session.</p>
      )}
    </Card>
  )
}
