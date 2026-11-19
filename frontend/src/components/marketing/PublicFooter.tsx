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

const LEGAL_LINKS: FooterLink[] = [
  { name: 'Privacy (draft)', to: '/legal/privacy' },
  { name: 'Terms (draft)', to: '/legal/terms' },
]

type PublicFooterProps = {
  variant?: 'dark' | 'light'
  className?: string
}

/** Q-TeleScope footer: brand column · link grid · copyright left / legal right. */
export function PublicFooter({ variant = 'dark', className }: PublicFooterProps) {
  const year = new Date().getFullYear()
  const dark = variant === 'dark'

  return (
    <footer
      className={cn(
        'relative z-20 w-full border-t',
        dark ? 'border-white/10 bg-[#070b14] text-white' : 'border-border bg-card text-foreground',
        className,
      )}
      aria-label="Site footer"
    >
      <div className="qrp-public-footer__wrap py-12 lg:py-16">
        <div className="qrp-public-footer__grid">
          <div className="qrp-public-footer__brand space-y-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className={cn('h-10 w-auto', dark && 'brightness-0 invert')} />
              <div className="text-left">
                <p className="type-page-title type-trim">Quantum Resource Portal</p>
                <p className={cn('acr text-xs font-medium', dark ? 'text-white/50' : 'text-muted-foreground')}>
                  C-DAC Quantum Platform
                </p>
              </div>
            </Link>
            <p className={cn('hyphenate max-w-sm text-sm leading-relaxed text-pretty', dark ? 'text-white/60' : 'text-muted-foreground')}>
              Institution-wide governance for quantum workloads: multi-stage approvals, quotas, fleet operations, and
              audit evidence.
            </p>
            <p className={cn('text-xs', dark ? 'text-white/40' : 'text-muted-foreground')}>
              Centre for Development of Advanced Computing (C-DAC)
            </p>
          </div>

          <div className="qrp-public-footer__cols">
            {SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className={cn('acr text-[11px] font-bold', dark ? 'text-white/80' : 'text-foreground')}>{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {link.to ? (
                        <Link
                          to={link.to}
                          className={cn(
                            'fs-link text-sm transition',
                            dark ? 'text-white/55 hover:text-white' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {link.name}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className={cn(
                            'fs-link text-sm transition',
                            dark ? 'text-white/55 hover:text-white' : 'text-muted-foreground hover:text-foreground',
                          )}
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

        <div
          className={cn('qrp-public-footer__bar', dark ? 'border-white/10 text-white/45' : 'text-muted-foreground')}
        >
          <p className="max-w-prose">© {year} Centre for Development of Advanced Computing (C-DAC). All rights reserved.</p>
          <div className="qrp-public-footer__bar-links">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.name} to={link.to!} className={cn('fs-link font-semibold', dark ? 'hover:text-white' : 'hover:text-foreground')}>
                {link.name}
              </Link>
            ))}
            <a href="/#capabilities" className={cn('font-semibold', dark ? 'hover:text-white' : 'hover:text-foreground')}>
              Capabilities
            </a>
            <Link to="/login" className={cn('font-semibold', dark ? 'hover:text-white' : 'hover:text-foreground')}>
              Sign in
            </Link>
            <Link to="/system/status" className={cn('font-semibold', dark ? 'hover:text-white' : 'hover:text-foreground')}>
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}