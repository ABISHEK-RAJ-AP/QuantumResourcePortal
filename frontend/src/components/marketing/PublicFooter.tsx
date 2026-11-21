import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { LogoMark } from '@/components/brand/LogoMark'
import { parsePublicHashHref, scrollToLandingSection } from '@/components/marketing/hashNav'
import { cn } from '@/lib/utils'

type FooterLink = { name: string; to?: string; href?: string }

const SECTIONS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { name: 'Overview', to: '/' },
      { name: 'Capabilities', href: '/#capabilities' },
      { name: 'Modules', href: '/#features' },
      { name: 'Sign in', to: '/login' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { name: 'Workflow', href: '/#workflow' },
      { name: 'FAQ', href: '/#faq' },
      { name: 'Register', to: '/register' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { name: 'Approval stages', href: '/#workflow' },
      { name: 'Module map', href: '/#features' },
      { name: 'Open workspace', to: '/login' },
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
  /** Auth routes — copyright bar only (Q-TeleScope compact footer). */
  compact?: boolean
}

function FooterHashLink({
  href,
  children,
  className,
  onAfterNav,
}: {
  href: string
  children: ReactNode
  className?: string
  onAfterNav?: () => void
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const parsed = parsePublicHashHref(href)

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!parsed) return
    const { path, hash } = parsed
    if (pathname !== path && !(path === '/' && pathname === '/')) {
      event.preventDefault()
      void navigate({ pathname: path, hash: hash.slice(1) })
      onAfterNav?.()
      return
    }
    event.preventDefault()
    if (path !== pathname) void navigate(path)
    scrollToLandingSection(hash)
    window.history.replaceState(null, '', `${path}${hash}`)
    onAfterNav?.()
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

/** Q-TeleScope footer: brand column · link grid · copyright left / legal right. */
export function PublicFooter({ variant = 'dark', className, compact = false }: PublicFooterProps) {
  const year = new Date().getFullYear()
  const dark = variant === 'dark'

  const linkClass = cn(
    'fs-link text-sm transition',
    dark ? 'text-white/55 hover:text-white' : 'text-muted-foreground hover:text-foreground',
  )

  const renderLink = (link: FooterLink) => {
    if (link.to) {
      return (
        <Link to={link.to} className={linkClass}>
          {link.name}
        </Link>
      )
    }
    if (link.href) {
      return (
        <FooterHashLink href={link.href} className={linkClass}>
          {link.name}
        </FooterHashLink>
      )
    }
    return null
  }

  return (
    <footer
      className={cn(
        'qrp-public-footer relative z-20 w-full border-t',
        compact && 'qrp-public-footer--compact',
        dark ? 'border-white/10 bg-[#070b14] text-white' : 'border-border bg-card text-foreground',
        className,
      )}
      aria-label="Site footer"
    >
      <div className={cn('qrp-public-footer__inner', compact && 'py-4')}>
        {!compact ? (
          <div className="qrp-public-footer__grid">
            <div className="qrp-public-footer__brand space-y-4">
              <Link to="/" className="flex items-center gap-3">
                <LogoMark className={cn('h-10 w-auto shrink-0', dark && 'brightness-0 invert')} />
                <div className="flex flex-col text-left">
                  <span className="text-xl font-extrabold tracking-tight">Quantum Resource Portal</span>
                  <span className={cn('acr text-xs font-semibold', dark ? 'text-white/50' : 'text-muted-foreground')}>
                    C-DAC Quantum Platform
                  </span>
                </div>
              </Link>
              <p
                className={cn(
                  'hyphenate max-w-sm text-sm leading-relaxed text-pretty',
                  dark ? 'text-white/60' : 'text-muted-foreground',
                )}
              >
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
                  <h3
                    className={cn(
                      'text-xs font-bold tracking-wider uppercase',
                      dark ? 'text-white/80' : 'text-foreground',
                    )}
                  >
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.name}>{renderLink(link)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            'qrp-public-footer__bar',
            !compact && 'mt-0',
            compact && 'mt-0 border-0 pt-0',
            dark ? 'border-white/10 text-white/45' : 'text-muted-foreground',
          )}
        >
          <p className="max-w-prose text-xs sm:text-sm">
            © {year} Centre for Development of Advanced Computing (C-DAC). All rights reserved.
            {!compact ? <span className="hidden sm:inline"> · Public copy reviewed Nov 2026</span> : null}
          </p>
          <div className="qrp-public-footer__bar-links">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.name}
                to={link.to!}
                className={cn('fs-link text-xs font-semibold sm:text-sm', dark ? 'hover:text-white' : 'hover:text-foreground')}
              >
                {link.name}
              </Link>
            ))}
            <FooterHashLink
              href="/#capabilities"
              className={cn('text-xs font-semibold sm:text-sm', dark ? 'hover:text-white' : 'hover:text-foreground')}
            >
              Capabilities
            </FooterHashLink>
            <Link
              to="/login"
              className={cn('text-xs font-semibold sm:text-sm', dark ? 'hover:text-white' : 'hover:text-foreground')}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}