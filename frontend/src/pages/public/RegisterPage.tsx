import { Link } from 'react-router'

import { AuthPanel } from '@/components/auth/AuthPanel'

/**
 * Request-access page (RBAC-6). Self-service registration with a self-chosen role is
 * disabled; admins create accounts and assign roles.
 */
export function RegisterPage() {
  return (
    <AuthPanel
      title="Request access"
      subtitle="Accounts are created by a platform administrator"
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        Self-service sign-up is disabled on this deployment. Contact your administrator to be added,
        then sign in with the credentials they provide.
      </p>
      <Link className="btn-primary mt-6 inline-flex w-full justify-center" to="/login">
        Back to sign in
      </Link>
    </AuthPanel>
  )
}
