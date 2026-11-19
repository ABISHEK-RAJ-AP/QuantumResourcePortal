import { Link } from 'react-router'

export type Crumb = {
  label: string
  to?: string
}

/** Q-TeleScope PageHeader.splitBreadcrumbs — avoid duplicating the terminal crumb in the H1. */
export function splitPageCrumbs(crumbs: Crumb[] | undefined, title?: string): { navCrumbs: Crumb[]; kicker: string | null } {
  if (!crumbs?.length) return { navCrumbs: [], kicker: null }
  const withLink = crumbs.filter((c) => c.to)
  if (withLink.length > 0) {
    const navCrumbs = crumbs.filter((c, i) => Boolean(c.to) && i < crumbs.length - 1)
    if (navCrumbs.length > 0) return { navCrumbs, kicker: null }
  }
  const last = crumbs[crumbs.length - 1]
  if (crumbs.length >= 2 && last.label === title) {
    return { navCrumbs: [], kicker: crumbs[0]?.label ?? null }
  }
  if (crumbs.length === 1 && crumbs[0].label !== title) {
    return { navCrumbs: [], kicker: crumbs[0].label }
  }
  return { navCrumbs: [], kicker: null }
}

/** Cert Studio–style trail: Workspace / Review Queue / id */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null
  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground sm:text-sm"
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden className="px-1 text-muted-foreground/60">/</span> : null}
            {last || !item.to ? (
              <span className={last ? 'font-semibold text-foreground' : undefined}>{item.label}</span>
            ) : (
              <Link className="fs-link text-primary/90 hover:text-primary" to={item.to}>
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
