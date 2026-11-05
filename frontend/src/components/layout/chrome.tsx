import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ScrollText,
  Server,
  Settings2,
  Shield,
  Siren,
  Sun,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import type { LucideIcon } from 'lucide-react'

import { asList, qre } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { DataFreshness } from '@/components/data/DataFreshness'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { PageChromeProvider, usePageChrome } from '@/components/layout/page-context'
import { A11yPreheader } from '@/components/shell/A11yPreheader'
import { QrpQuickActionDock } from '@/components/shell/QrpQuickActionDock'
import { WorkspaceLayoutControls } from '@/components/shell/WorkspaceLayoutControls'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { clearSession, getSessionUser } from '@/lib/session'
import { cn } from '@/lib/utils'

/**
 * Lifecycle rail — Submit → Review → Hold → Dispatch → Reconcile → Audit.
 * Users/roles sit under Admin (directory work), not Review. Status lives inside Settings.
 */
const NAV: {
  label: string
  items: { to: string; label: string; icon: LucideIcon; end?: boolean; badgeKey?: 'approvals' | 'reconcile' | 'alerts' | 'incidents' }[]
}[] = [
  {
    label: 'Command',
    items: [
      { to: '/qrp', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/qrp/centre', label: 'Operations Centre', icon: Gauge },
    ],
  },
  {
    label: 'Review',
    items: [
      { to: '/qrp/approvals', label: 'Review Queue', icon: ClipboardList, badgeKey: 'approvals' },
      { to: '/qrp/projects', label: 'Projects', icon: Users },
    ],
  },
  {
    label: 'Operate',
    items: [
      { to: '/qrp/backends', label: 'Backends', icon: Server },
      { to: '/qrp/queues', label: 'Queues', icon: Gauge },
      { to: '/qrp/jobs', label: 'Dispatch & Jobs', icon: ClipboardList },
      { to: '/qrp/reconciliation', label: 'Reconciliation', icon: ClipboardList, badgeKey: 'reconcile' },
      { to: '/qrp/support', label: 'Alerts', icon: Siren, badgeKey: 'alerts' },
      { to: '/qrp/incidents', label: 'Incidents', icon: Siren, badgeKey: 'incidents' },
    ],
  },
  {
    label: 'Schedule',
    items: [
      { to: '/qrp/reservations', label: 'Reservations', icon: CalendarClock },
      { to: '/qrp/scheduling', label: 'Schedule hold', icon: CalendarClock },
    ],
  },
  {
    label: 'Govern',
    items: [
      { to: '/qrp/policies', label: 'Policies', icon: Shield },
      { to: '/qrp/quotas', label: 'Quotas & Usage', icon: Gauge },
      { to: '/qrp/metering', label: 'Metering', icon: Gauge },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/qrp/inventory', label: 'Inventory', icon: Boxes },
      { to: '/qrp/pools', label: 'Resource Pools', icon: Boxes },
      { to: '/qrp/providers', label: 'Providers', icon: Server, end: true },
      { to: '/qrp/connectors', label: 'Connectors', icon: Server },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/qrp/audit', label: 'Audit Trail', icon: ScrollText },
      { to: '/qrp/evidence', label: 'Evidence', icon: ScrollText },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/qrp/users', label: 'Users & Roles', icon: Users },
      { to: '/qrp/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

function pathInGroup(pathname: string, items: { to: string; end?: boolean }[]) {
  return items.some((item) => {
    if (item.end) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  })
}

const OPEN_KEY = 'qrp_nav_open'
const COLLAPSE_KEY = 'qrp_nav_collapsed'

function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function ShellInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getSessionUser()
  const { chrome } = usePageChrome()
  const { theme, toggleTheme } = useTheme()
  const prefs = useWorkspacePrefs()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const saved = loadOpen()
    return Object.fromEntries(
      NAV.map((g) => [g.label, saved[g.label] ?? (g.label === 'Command' || g.label === 'Review')]),
    )
  })

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, JSON.stringify(open))
  }, [open])

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev }
      for (const g of NAV) {
        if (pathInGroup(location.pathname, g.items)) next[g.label] = true
      }
      return next
    })
  }, [location.pathname])

  const queue = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<{ queue?: number; in_review?: number }>('/governance/summary'),
    retry: false,
  })
  const reconcile = useQuery({
    queryKey: ['nav-reconcile-count'],
    queryFn: async () => {
      const rows = asList(await qre<unknown>('/dispatch-attempts'))
      return rows.filter((r) => {
        const s = String(r.dispatch_state || '')
        return s === 'dispatch_unresolved' || s === 'dispatch_authorized'
      }).length
    },
    retry: false,
  })
  const opsCentre = useQuery({
    queryKey: ['operations-centre-nav'],
    queryFn: () => qre<{ operations?: { active_alerts?: number; open_incidents?: number } }>('/operations/centre'),
    retry: false,
  })
  const badges: Record<'approvals' | 'reconcile' | 'alerts' | 'incidents', number | undefined> = {
    approvals: queue.isError ? undefined : Number(queue.data?.queue ?? queue.data?.in_review ?? 0),
    reconcile: reconcile.isError ? undefined : reconcile.data,
    alerts: opsCentre.isError ? undefined : Number(opsCentre.data?.operations?.active_alerts ?? 0),
    incidents: opsCentre.isError ? undefined : Number(opsCentre.data?.operations?.open_incidents ?? 0),
  }
  const displayName = user?.full_name || user?.username || 'Signed in'

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex min-h-0 w-full flex-1 bg-surface text-foreground">
      <aside
        className={cn(
          'sticky top-8 flex h-[calc(100svh-2rem)] shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
      >
        <div className={cn('flex items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-4')}>
          <LogoMark className={cn('shrink-0', collapsed ? 'h-7 w-auto' : 'h-8 w-auto')} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">C-DAC</p>
              <p className="truncate text-xs text-muted-foreground">Quantum Resource Portal</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-3" aria-label="Workspace">
          {NAV.map((group) => {
            const expanded = collapsed || open[group.label] !== false
            return (
              <div key={group.label}>
                {!collapsed && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase hover:bg-accent"
                    title={group.label}
                    aria-expanded={expanded}
                    onClick={() => setOpen((prev) => ({ ...prev, [group.label]: !expanded }))}
                  >
                    {group.label}
                    <ChevronDown className={cn('size-3.5 transition-transform', expanded ? 'rotate-0' : '-rotate-90')} />
                  </button>
                )}
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <ul className="min-h-0 space-y-0.5 overflow-hidden">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            title={item.label}
                            className={({ isActive }) =>
                              cn(
                                'relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                                collapsed && 'justify-center px-0',
                                isActive
                                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                  : 'text-sidebar-foreground hover:bg-accent',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span
                                    aria-hidden
                                    className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-primary"
                                  />
                                )}
                                <Icon aria-hidden className="size-4 shrink-0" />
                                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                                {!collapsed &&
                                  item.badgeKey &&
                                  typeof badges[item.badgeKey] === 'number' &&
                                  (badges[item.badgeKey] as number) > 0 && (
                                  <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                                    {badges[item.badgeKey]}
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <div className={cn('rounded-xl bg-muted/60', collapsed ? 'p-2' : 'px-3 py-2.5')}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  title={displayName}
                >
                  {initials(displayName)}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="grid size-8 place-items-center rounded-lg border border-input bg-card hover:bg-accent"
                  aria-label="Sign out"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.role || 'Operator'}
                      {user?.org ? ` · ${user.org}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-2 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-8 z-10 border-b border-border/80 bg-card/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {chrome.crumbs && chrome.crumbs.length > 0 ? (
                <Breadcrumbs items={chrome.crumbs} />
              ) : chrome.eyebrow ? (
                <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{chrome.eyebrow}</p>
              ) : null}
              <h1 className="text-2xl font-semibold tracking-tight text-balance">{chrome.title || 'Workspace'}</h1>
              {chrome.description ? (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{chrome.description}</p>
              ) : null}
            </div>
            <div className="flex min-w-0 max-w-full shrink-0 flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <DataFreshness updatedAt={chrome.updatedAt} />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <WorkspaceLayoutControls />
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-lg border border-input hover:bg-accent"
                  aria-label="Refresh page"
                  title="Refresh"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="size-4" />
                </button>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-lg border border-input hover:bg-accent"
                  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </header>
        <div
          id="page-content"
          className="shell-canvas min-w-0 flex-1 px-4 py-4 sm:px-5 lg:px-6 pb-24"
          data-density={prefs.density}
          data-chart-size={prefs.chartSize}
          data-kpi={prefs.kpiLayout}
          tabIndex={-1}
        >
          <Outlet />
        </div>
      </div>
      <QrpQuickActionDock />
    </div>
  )
}

export function AppShell() {
  return (
    <PageChromeProvider>
      <div className="flex min-h-svh flex-col">
        <A11yPreheader />
        <div className="flex min-h-0 min-w-0 flex-1">
          <ShellInner />
        </div>
      </div>
    </PageChromeProvider>
  )
}
