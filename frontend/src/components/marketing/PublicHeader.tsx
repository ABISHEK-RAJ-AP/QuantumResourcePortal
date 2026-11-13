import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Menu, Monitor, Moon, Sun, X } from 'lucide-react'

import { LogoMark } from '@/components/brand/LogoMark'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Capabilities', href: '/#capabilities' },
  { label: 'Modules', href: '/#modules' },
  { label: 'Workflow', href: '/#workflow' },
  { label: 'FAQ', href: '/#faq' },
]

/** Full-bleed header: brand left · nav centre · actions right. A11y lives in A11yPreheader. */
export function PublicHeader({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const { theme, preference, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [open, setOpen] = useState(false)

  const onLogin = pathname.startsWith('/login')
  const onRegister = pathname.startsWith('/register')

  const iconBtn =
    'grid size-9 shrink-0 place-items-center rounded-lg border border-input bg-card text-foreground transition hover:bg-accent'

  return (
    <header
      className={cn(
        'sticky top-8 z-50 w-full border-b border-border bg-card text-foreground',
        className,
      )}
    >
      <div className="relative flex w-full min-h-[76px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
        <div className="relative z-10 flex min-w-0 shrink items-center">
          <Link to="/" className="group flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
            <LogoMark className={cn('h-11 w-auto shrink-0 transition-transform group-hover:scale-105', dark && 'brightness-0 invert')} />
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold tracking-tight whitespace-nowrap sm:text-xl">
                Quantum Resource Portal
              </p>
              <p className="hidden truncate text-xs font-medium whitespace-nowrap text-muted-foreground sm:block">
                C-DAC Governance
              </p>
            </div>
          </Link>
        </div>

        <nav
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden -translate-y-1/2 justify-center xl:flex"
          aria-label="Page sections"
        >
          <div className="pointer-events-auto flex items-center gap-1">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="relative z-10 flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            className={iconBtn}
            aria-label={
              preference === 'light'
                ? 'Switch to dark theme'
                : preference === 'dark'
                  ? 'Follow system theme'
                  : 'Switch to light theme'
            }
            title={
              preference === 'system'
                ? `System (${theme})`
                : preference === 'dark'
                  ? 'Dark theme'
                  : 'Light theme'
            }
            onClick={toggleTheme}
          >
            {preference === 'system' ? (
              <Monitor className="size-4" />
            ) : dark ? (
              <Sun className="size-4 text-warning" />
            ) : (
              <Moon className="size-4" />
            )}
          </button>

          <Link
            to="/login"
            className={cn(
              'hidden rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap md:inline-flex',
              onLogin ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
            )}
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className={cn(
              'hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold whitespace-nowrap text-primary-foreground hover:brightness-95 md:inline-flex',
              onRegister && 'ring-2 ring-primary/40',
            )}
          >
            Get started
            <ArrowRight className="size-4" />
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

      {open && (
        <div className="border-t border-border px-4 py-4 sm:px-6 xl:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-base font-semibold hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              <Link to="/login" className="btn-secondary flex-1 justify-center" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link to="/register" className="btn-primary flex-1 justify-center" onClick={() => setOpen(false)}>
                Get started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
