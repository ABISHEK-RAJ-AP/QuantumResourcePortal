/** 403 access-denied page (RBAC-6, screen F). Explains what was blocked and offers a safe exit. */
import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'

export function AccessDeniedPage({ permission }: { permission?: string }) {
  return (
    <main id="main-content" className="qrp-system-notice flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <span className="qrp-system-notice__icon">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </span>
      <div>
        <h1 className="qrp-system-notice__title">Access denied</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You do not have permission to view this page.
          {permission ? (
            <>
              {' '}
              It requires <span className="font-mono text-foreground">{permission}</span>.
            </>
          ) : null}{' '}
          Ask your <Link className="font-medium text-primary hover:underline" to="/qrp/organization?tab=people">organization administrator</Link>{' '}
          to grant access.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/qrp" className="btn-primary text-sm">
          Back to Home
        </Link>
        <Link to="/qrp/settings" className="btn-ghost text-sm">
          Settings
        </Link>
      </div>
    </main>
  )
}
