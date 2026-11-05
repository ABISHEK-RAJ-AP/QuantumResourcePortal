import { Link } from 'react-router'

export type Crumb = {
  label: string
  to?: string
}

/** Cert Studio–style trail: Workspace / Review Queue / id */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden className="opacity-50">/</span> : null}
            {last || !item.to ? (
              <span className={last ? 'text-foreground' : undefined}>{item.label}</span>
            ) : (
              <Link className="hover:text-foreground hover:underline" to={item.to}>
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
