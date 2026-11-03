import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { PublicShell } from '@/components/marketing/PublicShell'

/** Router-level error UI — replaces the default “Hey developer” crash screen. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong'

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Portal error</p>
        <h1 className="text-3xl font-semibold tracking-tight">We hit a snag</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Refresh
          </button>
          <Link to="/" className="btn-secondary">
            Back home
          </Link>
        </div>
      </main>
    </PublicShell>
  )
}
