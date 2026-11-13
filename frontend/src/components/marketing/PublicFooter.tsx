import { Link } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { cn } from '@/lib/utils'

type FooterLink = { name: string; to?: string; href?: string }

const SECTIONS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { name: 'Overview', to: '/' },
      { name: 'Capabilities', href: '/#capabilities' },
      { name: 'Modules', href: '/#modules' },
      { name: 'Sign in', to: '/login' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { name: 'Workflow', href: '/#workflow' },
      { name: 'FAQ', href: '/#faq' },
      { name: 'Register', to: '/register' },
      { name: 'Platform status', to: '/system/status' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { name: 'Approvals', to: '/qrp/approvals' },
      { name: 'Policies', to: '/qrp/policies' },
      { name: 'Quotas', to: '/qrp/quotas' },
    ],
  },
]

type PublicFooterProps = {
  variant?: 'dark' | 'light'
  className?: string
}

/** Cert Studio / Q-TeleScope public footer: brand + link columns + copyright bar. */
export function PublicFooter({ variant = 'dark', className }: PublicFooterProps) {
  const year = new Date().getFullYear()
  const dark = variant === 'dark'

  return (
    <footer
      className={cn('relative z-20 w-full border-t border-border bg-card text-foreground', className)}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-6xl px-6 py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="space-y-4 lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className={cn('h-10 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-lg font-semibold tracking-tight">Quantum Resource Portal</p>
                <p className="text-xs font-medium text-muted-foreground">C-DAC Quantum Platform</p>
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Institution-wide governance for quantum workloads: multi-stage approvals, quotas, fleet operations, and
              audit evidence.
            </p>
            <p className="text-xs text-muted-foreground">
              Centre for Development of Advanced Computing (C-DAC)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-xs font-bold tracking-[0.14em] uppercase text-foreground">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {link.to ? (
                        <Link
                          to={link.to}
                          className="text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          {link.name}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          {link.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {year} Centre for Development of Advanced Computing (C-DAC). All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/#capabilities" className="font-semibold hover:underline">
              Capabilities
            </a>
            <Link to="/login" className="font-semibold hover:underline">
              Sign in
            </Link>
            <Link to="/system/status" className="font-semibold hover:underline">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
