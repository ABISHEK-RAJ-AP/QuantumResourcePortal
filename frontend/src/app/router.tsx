import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/chrome'
import {
  ApprovalHistoryPage,
  AlertDetailPage,
  AssetDetailPage,
  BackendDetailPage,
  ConnectorsPage,
  CentrePage,
  DispatchPage,
  EntitlementsPage,
  NotificationsPage,
  IncidentDetailPage,
  IncidentsPage,
  JobDetailPage,
  JobsPage,
  OnboardingPage,
  PoolDetailPage,
  ProviderDetailPage,
  ProjectDetailPage,
  RegisterAssetPage,
  ReconciliationPage,
  SchedulingPage,
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
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/public/ResetPasswordPage'
import { RegisterPage } from '@/pages/public/RegisterPage'
import { MfaPage } from '@/pages/public/MfaPage'
import { PrivacyPage, TermsPage } from '@/pages/public/LegalPage'
import { RouteError } from '@/components/routing/RouteError'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { useAuth } from '@/auth/hooks'
import { RolesPage } from '@/pages/admin/RolesPage'
import { RoleEditorPage } from '@/pages/admin/RoleEditorPage'
import { PermissionsPage } from '@/pages/admin/PermissionsPage'
import { UsersAdminPage } from '@/pages/admin/UsersAdminPage'
import { UserPermissionsPage } from '@/pages/admin/UserPermissionsPage'
import { ProfilePage } from '@/pages/system/ProfilePage'
import { SettingsPage } from '@/pages/system/SettingsPage'
import { OrganizationHubPage } from '@/pages/organization/OrganizationHubPage'
import { AccessDeniedPage } from '@/pages/system/AccessDeniedPage'

function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (!loading && user) return <Navigate to="/qrp" replace />
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
    path: '/forgot-password',
    element: (
      <PublicOnly>
        <ForgotPasswordPage />
      </PublicOnly>
    ),
    errorElement: <RouteError />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    errorElement: <RouteError />,
  },
  { path: '/mfa', element: <MfaPage />, errorElement: <RouteError /> },
  { path: '/legal/privacy', element: <PrivacyPage />, errorElement: <RouteError /> },
  { path: '/legal/terms', element: <TermsPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { path: '/qrp', element: <OverviewPage /> },
          { path: '/qrp/overview', element: <Navigate to="/qrp" replace /> },
          { path: '/qrp/users', element: <Navigate to="/qrp/admin/users" replace /> },
          { path: '/qrp/queues', element: <Navigate to="/qrp/jobs?tab=queues" replace /> },
          { path: '/qrp/backends', element: <Navigate to="/qrp/inventory?tab=backends" replace /> },
          { path: '/qrp/pools', element: <Navigate to="/qrp/inventory?tab=pools" replace /> },
          { path: '/qrp/connectors', element: <ConnectorsPage /> },
          { path: '/qrp/evidence', element: <Navigate to="/qrp/audit" replace /> },
          { path: '/qrp/admin/roles', element: <Navigate to="/qrp/admin/users?tab=roles" replace /> },
          { path: '/qrp/admin/permissions', element: <Navigate to="/qrp/admin/users?tab=catalogue" replace /> },
          { path: '/qrp/approvals', element: <ApprovalsPage /> },
          { path: '/qrp/approvals/history', element: <ApprovalHistoryPage /> },
          { path: '/qrp/approvals/:workloadId', element: <ApprovalDetailPage /> },
          { path: '/qrp/projects', element: <ProjectsPage /> },
          { path: '/qrp/projects/:projectId', element: <ProjectDetailPage /> },
          { path: '/qrp/inventory', element: <InventoryPage /> },
          { path: '/qrp/inventory/register', element: <RegisterAssetPage /> },
          { path: '/qrp/inventory/new', element: <Navigate to="/qrp/inventory/register?mode=single&step=method" replace /> },
          {
            path: '/qrp/inventory/import',
            element: <Navigate to="/qrp/inventory/register?mode=bulk&step=details" replace />,
          },
          { path: '/qrp/inventory/:assetId', element: <AssetDetailPage /> },
          { path: '/qrp/pools/:poolId', element: <PoolDetailPage /> },
          { path: '/qrp/providers', element: <ProvidersPage /> },
          { path: '/qrp/providers/onboarding', element: <OnboardingPage /> },
          { path: '/qrp/providers/:providerId', element: <ProviderDetailPage /> },
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
          { path: '/qrp/backends/:backendId', element: <BackendDetailPage /> },
          { path: '/qrp/jobs', element: <JobsPage /> },
          { path: '/qrp/jobs/:jobId', element: <JobDetailPage /> },
          { path: '/qrp/support/:alertId', element: <AlertDetailPage /> },
          { path: '/qrp/reconciliation', element: <ReconciliationPage /> },
          { path: '/qrp/dispatch', element: <DispatchPage /> },
          { path: '/qrp/notifications', element: <NotificationsPage /> },
          { path: '/qrp/procurement', element: <ProcurementPage /> },
          { path: '/qrp/entitlements', element: <EntitlementsPage /> },
          { path: '/qrp/settings', element: <SettingsPage /> },
          { path: '/qrp/organization', element: <OrganizationHubPage /> },
          { path: '/qrp/settings/organization', element: <Navigate to="/qrp/organization" replace /> },
          { path: '/qrp/profile', element: <ProfilePage /> },
          // RBAC administration (RBAC-6) — each route is permission-gated; the backend also enforces.
          {
            path: '/qrp/admin/roles',
            element: (
              <ProtectedRoute permission="role:read">
                <RolesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/qrp/admin/roles/new',
            element: (
              <ProtectedRoute permission="role:create">
                <RoleEditorPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/qrp/admin/roles/:roleId',
            element: (
              <ProtectedRoute permission="role:read">
                <RoleEditorPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/qrp/admin/permissions',
            element: (
              <ProtectedRoute permission="permission:read">
                <PermissionsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/qrp/admin/users',
            element: (
              <ProtectedRoute permission="user:read">
                <UsersAdminPage />
              </ProtectedRoute>
            ),
          },
          {
            path: '/qrp/admin/users/:userId',
            element: (
              <ProtectedRoute permission="user:read">
                <UserPermissionsPage />
              </ProtectedRoute>
            ),
          },
          { path: '/403', element: <AccessDeniedPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace />, errorElement: <RouteError /> },
])
