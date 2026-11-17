# QRP implementation tracker

| Sprint | Scope | Status | Proof |
| --- | --- | --- | --- |
| 0 | Route audit + crawl spec | Partial | `docs/QRP_AUDIT.md` |
| 1 | Data truth: DataState, api errors, mappers | Done (local) | `DataState.tsx`, `apiMessage.ts`, `qreFields.ts`, Users/Settings/Policies/Quotas/Audit |
| 2 | Shell + IA: DataTable, nav, router hygiene | Done (local) | `DataTable.tsx`, `chrome.tsx`, `router.tsx`, dock demo gate |
| 3 | Draggable Home dashboard | Done (local) | `OverviewDashboardGrid.tsx` |
| 4 | Project scope links, breadcrumbs, MFA stub, e2e nav | Done (local) | `projectScope.ts`, `MfaPage`, scoped list APIs |
| 5 | Reservations: conflicts, transitions, scheduling links | Done (local) | `ReservationsPage`, `ReservationCalendar`, `SchedulingPage` |
| 6 | Jobs hub tabs, provider detail workspace, connectors route | Done (local) | `JobsPage`, `ProviderDetailPage`, `ConnectorsPage` |
| 7 | Inventory hub, asset/reconcile workspace, profile | Done (local) | `InventoryPage`, `AssetDetailPage`, `ReconciliationPage`, `ProfilePage` |
| 8 | Auth hardening, e2e auth/Access alignment, smoke script | Done (local) | `RequireAuth`, `AccountSecurity`, `AccessDeniedPage`, `auth-flow.spec.ts`, `test:e2e:smoke`, `docs/qa/sprint-8/` |
| 9–11 | Remaining workspace polish, hostile review, quota backend | Not started | `docs/QRP_AUDIT.md` |
| 12 | Full Playwright gate + push | Not started | `docs/QRP_PLAYWRIGHT_GATE.md` |

**No git push** until sprint 12 gate per product owner (2026-03).