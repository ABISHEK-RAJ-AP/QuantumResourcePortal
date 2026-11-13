/** Guided QRP console tour — targets use data-tour on chrome + pages. */

export type TourStep = {
  target: string
  path: string
  title: string
  body: string
  lesson?: string
}

export const QRP_TOUR_DONE_KEY = 'qrp_tour_done_v1'

export const QRP_TOUR_STEPS: TourStep[] = [
  {
    target: 'sidebar-nav',
    path: '/qrp',
    title: 'Navigation',
    body: 'Command, Review, Operate, Schedule, Govern, Catalogue, Records, Access, Admin. Collapse the rail when you know the icons.',
    lesson: 'Badges on Review / Reconcile / Alerts / Incidents show live backlog.',
  },
  {
    target: 'nav-overview',
    path: '/qrp',
    title: 'Overview',
    body: 'Pipeline strip, request stages, quota, and alerts. Needs-attention first.',
  },
  {
    target: 'page-pipeline',
    path: '/qrp',
    title: 'Lifecycle pipeline',
    body: 'Review → Hold → Dispatch → Incidents → Audit. Hot steps light when work waits.',
  },
  {
    target: 'page-kpis',
    path: '/qrp',
    title: 'Attention KPIs',
    body: 'My requests, fleet online, assets, active alerts — one glance posture.',
  },
  {
    target: 'nav-approvals',
    path: '/qrp/approvals',
    title: 'Review queue',
    body: 'Policy stages for workload packages. Decide here; dispatch happens after schedule hold.',
  },
  {
    target: 'nav-backends',
    path: '/qrp/backends',
    title: 'Backends',
    body: 'Fleet catalogue: modality, status, queue depth. Open a row for topology.',
  },
  {
    target: 'nav-centre',
    path: '/qrp/centre',
    title: 'Operations Centre',
    body: 'Fleet posture, queue depth, and open exceptions in one ops board.',
  },
  {
    target: 'header-notices',
    path: '/qrp',
    title: 'Notifications',
    body: 'Operator notices for review backlog, critical alerts, and reconcile work.',
  },
  {
    target: 'quick-dock',
    path: '/qrp',
    title: 'Quick actions',
    body: 'Lower-right dock: jump to review, holds, reconcile, incidents, alerts — and restart this tour.',
  },
]

export function shouldAutoStartTour() {
  try {
    return localStorage.getItem(QRP_TOUR_DONE_KEY) !== '1'
  } catch {
    return false
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(QRP_TOUR_DONE_KEY, '1')
  } catch {
    /* ignore */
  }
}
