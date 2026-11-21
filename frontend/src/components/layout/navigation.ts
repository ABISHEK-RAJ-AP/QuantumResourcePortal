import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Boxes,
  Building2,
  CalendarClock,
  CalendarRange,
  CheckSquare,
  ClipboardCheck,
  Cpu,
  FileText,
  FolderKanban,
  Gauge,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Plug,
  Scale,
  ScrollText,
  Send,
  Server,
  Settings2,
  Shield,
  Siren,
  Users,
} from 'lucide-react'

import type { WorkspaceType } from '@/lib/workspace'

export type NavBadgeKey = 'approvals' | 'reconcile' | 'alerts' | 'incidents'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  perm?: string
  badgeKey?: NavBadgeKey
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

const RESEARCHER_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [{ to: '/qrp', label: 'My Workspace', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Discover',
    items: [
      { to: '/qrp/inventory', label: 'Explore Resources', icon: Boxes, perm: 'asset:read' },
      { to: '/qrp/providers', label: 'Providers', icon: Server, perm: 'provider:read', end: true },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/qrp/approvals?scope=mine', label: 'My Workloads', icon: FileText, perm: 'workload:read' },
      { to: '/qrp/projects', label: 'Projects', icon: FolderKanban, perm: 'project:read' },
      { to: '/qrp/reservations', label: 'Reservations', icon: CalendarClock, perm: 'reservation:read' },
    ],
  },
  {
    label: 'Usage',
    items: [
      { to: '/qrp/quotas', label: 'Quotas', icon: Scale, perm: 'quota:read' },
      { to: '/qrp/metering', label: 'Metering', icon: Activity, perm: 'usage:read' },
    ],
  },
  {
    label: 'Support',
    items: [{ to: '/qrp/support', label: 'Help & Support', icon: LifeBuoy, perm: 'ticket:read' }],
  },
]

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [{ to: '/qrp', label: 'Governance Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Review',
    items: [
      { to: '/qrp/approvals', label: 'Request Review', icon: ClipboardCheck, perm: 'approval:read', badgeKey: 'approvals' },
      { to: '/qrp/approvals/history', label: 'Approval History', icon: History, perm: 'approval:read' },
    ],
  },
  {
    label: 'Allocate',
    items: [
      { to: '/qrp/reservations', label: 'Reservations', icon: CalendarClock, perm: 'reservation:read' },
      { to: '/qrp/scheduling', label: 'Scheduling', icon: CalendarRange, perm: 'reservation:create' },
    ],
  },
  {
    label: 'Dispatch',
    items: [
      { to: '/qrp/jobs', label: 'Jobs & Queues', icon: Cpu, perm: 'dispatch:read' },
      { to: '/qrp/dispatch', label: 'Dispatch', icon: Send, perm: 'dispatch:read' },
      { to: '/qrp/reconciliation', label: 'Reconciliation', icon: CheckSquare, perm: 'dispatch:read', badgeKey: 'reconcile' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/qrp/inventory', label: 'Inventory', icon: Boxes, perm: 'asset:read' },
      { to: '/qrp/providers', label: 'Providers', icon: Server, perm: 'provider:read', end: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/qrp/centre', label: 'Operations Centre', icon: Gauge, perm: 'governance:read' },
      { to: '/qrp/incidents', label: 'Incidents', icon: Siren, perm: 'incident:read', badgeKey: 'incidents' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/qrp/policies', label: 'Policies', icon: Shield, perm: 'policy:read' },
      { to: '/qrp/quotas', label: 'Quotas', icon: Scale, perm: 'quota:read' },
      { to: '/qrp/metering', label: 'Metering', icon: Activity, perm: 'usage:read' },
      { to: '/qrp/audit', label: 'Audit & Evidence', icon: ScrollText, perm: 'audit:read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/qrp/organization', label: 'Organization', icon: Building2 },
      { to: '/qrp/admin/users', label: 'People & Access', icon: Users, perm: 'user:read' },
      { to: '/qrp/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

const PROVIDER_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [{ to: '/qrp', label: 'Provider Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Requests',
    items: [{ to: '/qrp/approvals', label: 'Workload Assignments', icon: Inbox, badgeKey: 'approvals' }],
  },
  {
    label: 'Resources',
    items: [
      { to: '/qrp/inventory', label: 'Resource Inventory', icon: Boxes, perm: 'asset:read' },
      { to: '/qrp/inventory?tab=backends', label: 'Backends', icon: Cpu, perm: 'backend:read' },
      { to: '/qrp/connectors', label: 'Connectors', icon: Plug, perm: 'connector:read' },
    ],
  },
  {
    label: 'Availability',
    items: [{ to: '/qrp/reservations', label: 'Reservations', icon: CalendarClock }],
  },
  {
    label: 'Operations',
    items: [{ to: '/qrp/incidents', label: 'Incidents', icon: Siren, badgeKey: 'incidents' }],
  },
  {
    label: 'Admin',
    items: [{ to: '/qrp/providers/onboarding', label: 'Provider Settings', icon: Settings2 }],
  },
]

const NAV_BY_WORKSPACE: Record<WorkspaceType, NavGroup[]> = {
  researcher: RESEARCHER_NAV,
  admin: ADMIN_NAV,
  provider: PROVIDER_NAV,
}

/** Role-filtered sidebar groups; empty groups are dropped by the shell. */
export function getNavigation(workspace: WorkspaceType, permissions: Set<string>): NavGroup[] {
  return NAV_BY_WORKSPACE[workspace].map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.perm || permissions.has(item.perm)),
  }))
}