import { useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { scrollToLandingSection } from '@/components/marketing/hashNav'
import { Menu, X } from 'lucide-react'

import { LogoMark } from '@/components/brand/LogoMark'
import { ThemeIconToggle } from '@/components/theme/ThemeIconToggle'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Capabilities', href: '/#capabilities' },
  { label: 'Modules', href: '/#features' },
  { label: 'Workflow', href: '/#workflow' },
  { label: 'FAQ', href: '/#faq' },
]

/** Q-TeleScope pattern: brand left · section nav center · actions right. */
export function PublicHeader({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [open, setOpen] = useState(false)

  const onSectionNav = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const hashIndex = href.indexOf('#')
    if (hashIndex === -1) return
    const path = href.slice(0, hashIndex) || '/'
    const hash = href.slice(hashIndex)
    if (pathname !== path && pathname !== '/') {
      event.preventDefault()
      void navigate({ pathname: path, hash: hash.slice(1) })
      return
    }
    if (pathname === path || (path === '/' && pathname === '/')) {
      event.preventDefault()
      if (path !== pathname) void navigate(path)
      scrollToLandingSection(hash)
      window.history.replaceState(null, '', `${path}${hash}`)
      setOpen(false)
    }
  }

  const onLogin = pathname.startsWith('/login')
  const onRegister = pathname.startsWith('/register')
  const authSurface =
    pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')

  const iconBtn = cn(
    'grid size-9 shrink-0 place-items-center rounded-lg border transition',
    dark ? 'border-white/15 hover:bg-white/10' : 'border-input bg-card hover:bg-accent',
  )

  return (
    <header
      className={cn(
        'sticky top-8 z-50 w-full border-b backdrop-blur-xl',
        dark ? 'border-white/10 bg-[#0b1220]/90 text-white' : 'border-border bg-card/95 text-foreground',
        className,
      )}
    >
      <div className="qrp-public-header__inner">
        <div className="qrp-public-header__brand">
          <Link to="/" className="group flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
            <LogoMark className={cn('h-10 w-auto shrink-0 transition-transform group-hover:scale-105', dark && 'brightness-0 invert')} />
            <div className="flex min-w-0 flex-col text-left">
              <span className="truncate text-lg font-extrabold tracking-tight whitespace-nowrap sm:text-xl">
                Quantum Resource Portal
              </span>
              <span
                className={cn(
                  'acr hidden truncate text-[10.5px] font-semibold whitespace-nowrap sm:block',
                  dark ? 'text-white/50' : 'text-muted-foreground',
                )}
              >
                C-DAC Governance
              </span>
            </div>
          </Link>
        </div>

        {!authSurface ? (
          <nav className="qrp-public-header__nav" aria-label="Page sections">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => onSectionNav(e, link.href)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
                  dark ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="qrp-public-header__actions qrp-public-header__actions--cluster">
          <ThemeIconToggle
            dark={dark}
            onToggle={toggleTheme}
            label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className={iconBtn}
            sunClassName="text-amber-300"
          />

          <Link
            to="/login"
            className={cn(
              'qrp-public-header__signin hidden min-h-10 items-center rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap md:inline-flex',
              onLogin
                ? dark
                  ? 'bg-white/15 text-white'
                  : 'bg-accent text-accent-foreground'
                : dark
                  ? 'text-white/85 hover:bg-white/10'
                  : 'text-foreground hover:bg-accent',
            )}
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className={cn(
              'btn-primary landing-hero-cta hidden min-h-10 items-center justify-center px-4 text-sm font-semibold whitespace-nowrap md:inline-flex',
              onRegister && 'ring-2 ring-primary/40',
            )}
          >
            Register
          </Link>

          <button
            type="button"
            className={cn(iconBtn, 'xl:hidden')}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className={cn('border-t px-6 py-4 sm:px-8 xl:hidden', dark ? 'border-white/10' : 'border-border')}>
          <nav className="flex flex-col gap-1 text-left" aria-label="Mobile">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn('rounded-lg px-3 py-2.5 text-base font-semibold', dark ? 'hover:bg-white/10' : 'hover:bg-accent')}
                onClick={(e) => {
                  onSectionNav(e, link.href)
                  setOpen(false)
                }}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'inherit' }}>
              <Link to="/login" className="btn-primary justify-center" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link to="/register" className="fs-link px-3 py-2 text-center text-sm font-semibold" onClick={() => setOpen(false)}>
                Register organization
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}