import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/chrome'
import {
  ApprovalHistoryPage,
  AlertDetailPage,
  AssetDetailPage,
  BackendDetailPage,
  BackendsPage,
  CentrePage,
  ConnectorsPage,
  DispatchPage,
  EntitlementsPage,
  EvidencePage,
  NotificationsPage,
  ImportAssetsPage,
  IncidentDetailPage,
  IncidentsPage,
  JobDetailPage,
  JobsPage,
  QueuesPage,
  OnboardingPage,
  PoolDetailPage,
  PoolsPage,
  ProviderDetailPage,
  ProjectDetailPage,
  RegisterAssetPage,
  ReconciliationPage,
  SchedulingPage,
  SettingsPage,
  UsersPage,
  SlaPage,
} from '@/pages/workspace/continue'
import {
  ApprovalDetailPage,
  ApprovalsPage,
  AuditPage,
  InventoryPage,
  MeteringPage,
  OverviewPage,
  PoliciesPage,
  ProcurementPage,
  ProjectsPage,
  ProvidersPage,
  QuotasPage,
  ReservationsPage,
  SupportPage,
} from '@/pages/workspace/screens'
import { LandingPage } from '@/pages/public/LandingPage'
import { LoginPage } from '@/pages/public/LoginPage'
import { RegisterPage } from '@/pages/public/RegisterPage'
import { StatusPage } from '@/pages/system/StatusPage'
import { RouteError } from '@/components/routing/RouteError'
import { isSignedIn } from '@/lib/session'

function PublicOnly({ children }: { children: ReactNode }) {
  if (isSignedIn()) return <Navigate to="/qrp" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteError /> },
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
    errorElement: <RouteError />,
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>
    ),
    errorElement: <RouteError />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { path: '/qrp', element: <OverviewPage /> },
          { path: '/qrp/approvals', element: <ApprovalsPage /> },
          { path: '/qrp/approvals/history', element: <ApprovalHistoryPage /> },
          { path: '/qrp/approvals/:workloadId', element: <ApprovalDetailPage /> },
          { path: '/qrp/projects', element: <ProjectsPage /> },
          { path: '/qrp/users', element: <UsersPage /> },
          { path: '/qrp/projects/:projectId', element: <ProjectDetailPage /> },
          { path: '/qrp/inventory', element: <InventoryPage /> },
          { path: '/qrp/inventory/new', element: <RegisterAssetPage /> },
          { path: '/qrp/inventory/import', element: <ImportAssetsPage /> },
          { path: '/qrp/inventory/:assetId', element: <AssetDetailPage /> },
          { path: '/qrp/pools', element: <PoolsPage /> },
          { path: '/qrp/pools/:poolId', element: <PoolDetailPage /> },
          { path: '/qrp/providers', element: <ProvidersPage /> },
          { path: '/qrp/providers/onboarding', element: <OnboardingPage /> },
          { path: '/qrp/providers/:providerId', element: <ProviderDetailPage /> },
          { path: '/qrp/connectors', element: <ConnectorsPage /> },
          { path: '/qrp/policies', element: <PoliciesPage /> },
          { path: '/qrp/quotas', element: <QuotasPage /> },
          { path: '/qrp/reservations', element: <ReservationsPage /> },
          { path: '/qrp/scheduling', element: <SchedulingPage /> },
          { path: '/qrp/metering', element: <MeteringPage /> },
          { path: '/qrp/sla', element: <SlaPage /> },
          { path: '/qrp/audit', element: <AuditPage /> },
          { path: '/qrp/support', element: <SupportPage /> },
          { path: '/qrp/incidents', element: <IncidentsPage /> },
          { path: '/qrp/incidents/:incidentId', element: <IncidentDetailPage /> },
          { path: '/qrp/centre', element: <CentrePage /> },
          { path: '/qrp/backends', element: <BackendsPage /> },
          { path: '/qrp/backends/:backendId', element: <BackendDetailPage /> },
          { path: '/qrp/queues', element: <QueuesPage /> },
          { path: '/qrp/jobs', element: <JobsPage /> },
          { path: '/qrp/evidence', element: <EvidencePage /> },
          { path: '/qrp/jobs/:jobId', element: <JobDetailPage /> },
          { path: '/qrp/support/:alertId', element: <AlertDetailPage /> },
          { path: '/qrp/reconciliation', element: <ReconciliationPage /> },
          { path: '/qrp/dispatch', element: <DispatchPage /> },
          { path: '/qrp/notifications', element: <NotificationsPage /> },
          { path: '/qrp/procurement', element: <ProcurementPage /> },
          { path: '/qrp/entitlements', element: <EntitlementsPage /> },
          { path: '/qrp/settings', element: <SettingsPage /> },
          { path: '/system/status', element: <StatusPage framed /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace />, errorElement: <RouteError /> },
])
