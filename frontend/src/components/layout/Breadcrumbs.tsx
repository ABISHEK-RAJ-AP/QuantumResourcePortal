import { Link } from 'react-router'

export type Crumb = {
  label: string
  to?: string
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
