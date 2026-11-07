/** 403 access-denied page (RBAC-6, screen F). Explains what was blocked and offers a safe exit. */
import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'

export function AccessDeniedPage({ permission }: { permission?: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-critical/10 text-critical">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to view this page.
          {permission ? (
            <>
              {' '}
              It requires <span className="font-mono text-foreground">{permission}</span>.
            </>
          ) : null}{' '}
          If you believe you should have access, ask a platform administrator to grant it.
        </p>
      </div>
      <Link to="/qrp" className="btn-primary px-4 py-2 text-sm">
        Back to Overview
      </Link>
    </div>
  )
}
