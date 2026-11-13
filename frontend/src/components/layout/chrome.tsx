import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ScrollText,
  Search,
  Server,
  Settings2,
  Shield,
  Siren,
  Sun,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import type { LucideIcon } from 'lucide-react'

import { getNavigation } from '@/api/rbac'
import { asList, qre } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { DataFreshness } from '@/components/data/DataFreshness'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CommandPalette, type PaletteNavStatus } from '@/components/layout/command-palette'
import { PageChromeProvider, usePageChrome } from '@/components/layout/page-context'
import { ProductTour } from '@/components/onboarding/ProductTour'
import { A11yPreheader } from '@/components/shell/A11yPreheader'
import { OperatorNoticeBell } from '@/components/shell/OperatorNoticeBell'
import { QrpQuickActionDock } from '@/components/shell/QrpQuickActionDock'
import { WorkspaceLayoutControls } from '@/components/shell/WorkspaceLayoutControls'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageEnter } from '@/components/ui/PageEnter'
import { ToastHost } from '@/components/ui/ToastHost'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useAuth } from '@/auth/hooks'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { markTourDone, QRP_TOUR_STEPS, shouldAutoStartTour, type TourStep } from '@/lib/qrpTour'
import { cn } from '@/lib/utils'

/**
 * Compact IA (Hick / Miller / Occam): ≤7 groups, no twin destinations.
 * Deep routes stay live; sidebar only shows hubs (Jakob + TeleScope pattern).
 */
const NAV: {
  label: string
  items: {
    to: string
    label: string
    icon: LucideIcon
    end?: boolean
    perm?: string
    badgeKey?: 'approvals' | 'reconcile' | 'alerts' | 'incidents'
    tourId?: string
  }[]
}[] = [
  {
    label: 'Work',
    items: [
      { to: '/qrp', label: 'Overview', icon: LayoutDashboard, end: true, tourId: 'nav-overview' },
      { to: '/qrp/approvals', label: 'Review', icon: ClipboardList, badgeKey: 'approvals', tourId: 'nav-approvals' },
      { to: '/qrp/projects', label: 'Projects', icon: Users },
      { to: '/qrp/reservations', label: 'Reservations', icon: CalendarClock },
    ],
  },
  {
    label: 'Operate',
    items: [
      { to: '/qrp/backends', label: 'Fleet', icon: Server, tourId: 'nav-backends' },
      { to: '/qrp/jobs', label: 'Jobs', icon: ClipboardList },
      { to: '/qrp/reconciliation', label: 'Reconcile', icon: ClipboardList, badgeKey: 'reconcile' },
      { to: '/qrp/incidents', label: 'Incidents', icon: Siren, badgeKey: 'incidents' },
    ],
  },
  {
    label: 'Govern',
    items: [
      { to: '/qrp/quotas', label: 'Quotas', icon: Gauge },
      { to: '/qrp/policies', label: 'Policies', icon: Shield },
      { to: '/qrp/inventory', label: 'Inventory', icon: Boxes },
      { to: '/qrp/providers', label: 'Providers', icon: Server, end: true },
      { to: '/qrp/audit', label: 'Audit', icon: ScrollText },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/qrp/admin/users', label: 'Users', icon: Users, perm: 'user:read' },
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
  const queryClient = useQueryClient()
  const { user: authUser, permissions, logout: authLogout } = useAuth()
  const user = authUser
    ? { username: authUser.principal_id, role: authUser.roles[0] ?? 'User', full_name: '' }
    : null
  const location = useLocation()
  const { chrome } = usePageChrome()
  const { theme, preference, toggleTheme } = useTheme()
  const prefs = useWorkspacePrefs()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const saved = loadOpen()
    return Object.fromEntries(
      NAV.map((g) => [g.label, saved[g.label] ?? (g.label === 'Command' || g.label === 'Review')]),
    )
  })

  useEffect(() => {
    if (shouldAutoStartTour()) {
      const t = window.setTimeout(() => setTourOpen(true), 900)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [])

  const handleTourStep = useCallback(
    (step: TourStep) => {
      if (step.path && location.pathname !== step.path) {
        navigate(step.path)
      }
      // Expand rail while touring so labels + targets stay visible
      setCollapsed(false)
      setOpen(Object.fromEntries(NAV.map((g) => [g.label, true])))
    },
    [location.pathname, navigate],
  )

  const closeTour = useCallback(() => {
    markTourDone()
    setTourOpen(false)
  }, [])

  const navigation = useQuery({
    queryKey: ['me-navigation'],
    queryFn: getNavigation,
    retry: false,
  })
  const navItems = navigation.data?.items ?? []
  const paletteStatus: PaletteNavStatus = navigation.isError
    ? 'error'
    : navigation.isLoading
      ? 'loading'
      : 'ready'
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      openPalette()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPalette])

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
  // Nav badges only for actionable queues — alerts/incidents live in the bell (less chrome noise).
  const badges: Record<'approvals' | 'reconcile' | 'alerts' | 'incidents', number | undefined> = {
    approvals: queue.isError ? undefined : Number(queue.data?.queue ?? queue.data?.in_review ?? 0),
    reconcile: reconcile.isError ? undefined : reconcile.data,
    alerts: undefined,
    incidents: undefined,
  }
  const displayName = user?.full_name || user?.username || 'Signed in'

  async function logout() {
    setLogoutBusy(true)
    try {
      await authLogout()
      navigate('/login')
    } finally {
      setLogoutBusy(false)
      setLogoutOpen(false)
    }
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

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-3" aria-label="Workspace" data-tour="sidebar-nav">
          {NAV.map((group) => {
            // Hide items the principal lacks the permission for; drop a group that ends up empty.
            const items = group.items.filter((item) => !item.perm || permissions.has(item.perm))
            if (items.length === 0) return null
            const expanded = collapsed || open[group.label] !== false || tourOpen
            return (
              <div key={group.label}>
                {!collapsed && (
                  <button
                    type="button"
                    className="label-quiet flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
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
                    {items.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            title={item.label}
                            data-tour={item.tourId}
                            className={({ isActive }) =>
                              cn(
                                'relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
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
                                  <span className="min-w-5 rounded-md bg-primary/15 px-1.5 text-center text-[11px] font-semibold tabular-nums text-primary">
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
                  onClick={() => setLogoutOpen(true)}
                  className="grid size-8 place-items-center rounded-lg border border-input bg-card hover:bg-accent"
                  aria-label="Sign out"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            ) : (
              <>
                <NavLink
                  to="/qrp/profile"
                  className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-accent/60"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.role || 'Operator'}
                    </p>
                  </div>
                </NavLink>
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
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
        <header className="workspace-chrome-header sticky top-8 z-10 border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              {chrome.crumbs && chrome.crumbs.length > 0 ? (
                <Breadcrumbs items={chrome.crumbs} />
              ) : null}
              <h1 className="text-xl font-semibold text-balance sm:text-[1.35rem]">
                {chrome.title || 'Workspace'}
              </h1>
              {chrome.description ? (
                <p className="mt-0.5 line-clamp-2 max-w-prose text-sm leading-snug text-muted-foreground">
                  {chrome.description}
                </p>
              ) : null}
            </div>
            <div className="workspace-toolbar">
              <DataFreshness updatedAt={chrome.updatedAt} />
              <WorkspaceLayoutControls />
              <span data-tour="header-notices">
                <OperatorNoticeBell />
              </span>
              <button
                type="button"
                className="inline-flex h-9 min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-input px-2.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Open command palette"
                title="Go to page (Ctrl/Cmd+K)"
                onClick={openPalette}
              >
                <Search className="size-4 shrink-0" />
                <kbd className="hidden rounded border border-input bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
                  Ctrl/Cmd+K
                </kbd>
              </button>
              <button
                type="button"
                className="grid size-9 min-h-9 min-w-9 place-items-center rounded-lg border border-input hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Refresh page"
                  title="Refresh"
                  onClick={() => void queryClient.invalidateQueries()}
                >
                  <RefreshCw className="size-4" />
                </button>
              <button
                type="button"
                className="grid size-9 min-h-9 min-w-9 place-items-center rounded-lg border border-input hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
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
                  <Monitor className="size-4 text-foreground" />
                ) : theme === 'dark' ? (
                  <Sun className="size-4 text-warning" />
                ) : (
                  <Moon className="size-4 text-foreground" />
                )}
              </button>
            </div>
          </div>
        </header>
        <div
          id="page-content"
          className="shell-canvas relative min-w-0 flex-1 px-4 sm:px-5 lg:px-6 pb-24"
          data-density={prefs.density}
          data-chart-size={prefs.chartSize}
          data-kpi={prefs.kpiLayout}
          tabIndex={-1}
        >
          <PageEnter key={location.pathname}>
            <Outlet />
          </PageEnter>
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        items={navItems}
        status={paletteStatus}
        onStartTour={() => {
          closePalette()
          setTourOpen(true)
        }}
      />
      <QrpQuickActionDock onStartTour={() => setTourOpen(true)} />
      <ToastHost />
      <ProductTour open={tourOpen} steps={QRP_TOUR_STEPS} onStep={handleTourStep} onClose={closeTour} />
      <ConfirmDialog
        open={logoutOpen}
        title="Sign out"
        body="Your session on this device will end. Unsaved form work may be lost."
        confirmLabel="Sign out"
        danger
        busy={logoutBusy}
        onCancel={() => !logoutBusy && setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
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
