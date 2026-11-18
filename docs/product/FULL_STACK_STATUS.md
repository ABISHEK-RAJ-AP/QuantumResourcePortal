# QRP full-stack status (frontend · backend · API · DB · auth · cache)

**Repository:** `QuantumResourcePortal`  
**Last aligned to code:** commit series through `1a41e7a` (workspace UX + wizards)  
**Audience:** operators, integrators, and developers tracing UI → API → database.

Companion (navigation-focused): [`WORKSPACE_UI_CATALOG.md`](./WORKSPACE_UI_CATALOG.md).

---

## 1. What runs where

| Process | Default URL | Role |
| --- | --- | --- |
| **Vite dev server** | `http://localhost:5176` | Serves React SPA; **proxies** `/api`, `/healthz`, `/readyz` → backend (`QRP_API_TARGET`, default `http://127.0.0.1:8000`). |
| **FastAPI (QRE gateway)** | `http://127.0.0.1:8000` | JSON API under `/api/v1/*`; probes at `/healthz`, `/readyz` (no version prefix). |
| **PostgreSQL 16** | `DATABASE_URL` in `backend/.env` | Sessions, RBAC, audit log, identity tables (Alembic migrations `0001`–`0005`). |
| **Redis 6379** (optional) | `QRE_REDIS_URL` | CAPTCHA challenges + operational JSON cache; **not** session store. |

**Browser rule:** Session cookie is **same-origin** (browser → Vite → proxy → API). Cookies are **not** stored in `localStorage`. CSRF token is **in memory only** (refetched via `GET /api/v1/auth/csrf` after login).

**Wrong stack symptom:** Vite proxy **502** — nothing on `:8000`, or Q-TeleScope monolith bound to `:8000` instead of QRP. Frontend maps this in `lib/apiReachability.ts`.

---

## 2. API reachability & platform status

### Probes (unauthenticated)

| Endpoint | Purpose | Success |
| --- | --- | --- |
| `GET /healthz` | Liveness | `{ status: "ok", version, time }` |
| `GET /readyz` | Readiness | `200` + `status: "ready"` when all checks pass; else `503` |

**Readiness checks** (`gateway/health.py`):

| Check key | Meaning |
| --- | --- |
| `configuration` | Settings valid at boot |
| `database` | PostgreSQL ping |
| `migrations` | DB revision == code head |
| `identity_mfa` | MFA config consistent (deployment) |
| `cache_redis` | Redis reachable when cache enabled; else in-memory fallback ok |

**UI:** `/system/status` (`StatusPage`) polls liveness + readiness every **15s**; shows `DeploymentCapabilitiesPanel` from `GET /api/v1/auth/capabilities`.

### Authenticated module client

| Client | Path prefix | Auth |
| --- | --- | --- |
| `qre()` | `/api/v1` + module path | Cookie `qre_sid` + `X-CSRF-Token` on unsafe methods |
| `authFetch()` | `/api/v1/auth/*` public | No session |
| `apiRequest()` | arbitrary (`/readyz`, `/api/v1/admin/*`) | Same as above |

**Timeouts:** `authFetch` **12s**; shell session probe **8s**; Vite proxy **30s**.

---

## 3. Backend surface — what is **real** today

FastAPI mounts (`gateway/app.py`):

| Router | Prefix / tag | Status |
| --- | --- | --- |
| **health** | `/healthz`, `/readyz` | **Shipped** |
| **identity** | `/api/v1/auth/*`, `/me`, `/me/navigation`, `/me/permissions` | **Shipped** |
| **ping** | `/api/v1/rbac/ping-*` | **Shipped** (auth tests) |
| **admin** | `/api/v1/admin/*` | **Shipped** (roles, users, memberships) |
| **authz** | `/api/v1/authz/check` | **Shipped** |
| **audit (RBAC)** | `/api/v1/rbac/audit` | **Shipped** (list, export, verify chain) |
| **workspace_lab** | see below | **Lab only** (`QRE_ENV=lab`) |

### Lab stubs (`workspace_lab/api.py`) — demo aggregates only

When `settings.is_lab` is true, these **GET** routes return fixed demo JSON (`demo: true` on several):

- `/governance/summary`
- `/operations/centre`
- `/quotas/ledger` (no query params honoured in stub)
- `/queues`
- `/dispatch-attempts` (list shape)
- `/alerts/summary`
- `/governance/activity`
- `/approvals` (partial; shape differs from UI expectations in places)

Outside **lab**, these paths are **not mounted** → workspace `qre()` calls return **404** unless another service is added later.

### Workspace paths the UI calls but **no QRP router implements yet**

The Govern workspace UI is built against the **target SRS/LLD contract**. Unless you add module routers (or a BFF), these will **not** work in non-lab production:

`/projects`, `/projects/:id`, `/projects/:id/members`, `/workload-submissions`, `/approvals/*`, `/inventory/*`, `/providers`, `/reservations`, `/scheduling`, `/jobs`, `/backends`, `/queues`, `/virtual-pools`, `/connectors`, `/dispatch-icd`, `/incidents`, `/alerts/*`, `/meter-rollups`, `/governance/audit-events`, `/governance/institution-boundary`, `/evidence/snapshots`, `/users` (legacy workspace users API), `/approvals/policy`, `/quotas/evaluate`, etc.

**Admin path split:**

| UI area | Frontend calls | Backend |
| --- | --- | --- |
| Access (roles/users) | `/api/v1/admin/*` via `api/rbac.ts` | **Implemented** |
| Audit & Evidence page | `/governance/audit-events` | **Not implemented** (use `/rbac/audit` for identity/RBAC audit only) |

Document this gap when interpreting empty/error states on workspace pages.

---

## 4. Implemented API reference (authenticated unless noted)

### Public (`PUBLIC_API_SUFFIXES`)

| Method | Path | Body / response highlights |
| --- | --- | --- |
| GET | `/auth/capabilities` | MFA, captcha, session store metadata |
| GET | `/auth/captcha` | `captcha_id`, `captcha_image` (404 if captcha disabled) |
| POST | `/auth/login` | `username`, `password`, optional captcha → `Set-Cookie`, `csrf_token` |
| POST | `/auth/password/reset` | **501** stub (honest failure) |
| GET | `/auth/session` | Always 200; `authenticated` boolean |

### Session-required identity

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/logout` | Clears cookie |
| GET | `/me` | Same payload as authenticated session |
| GET | `/auth/csrf` | Rotates CSRF in DB |
| GET | `/me/navigation` | Module list from `authz.visible_modules` |
| GET | `/me/permissions` | Flat permissions + grants |

### Admin (`/admin/*`)

Roles: list, create, get, update, activate/deactivate, permission set, delete.  
Users: list, create, activate/deactivate, effective permissions.  
Memberships: list, grant, revoke.  
Pydantic `extra=forbid` on all bodies.

### RBAC audit (`/rbac/audit`)

| Method | Path | Permission |
| --- | --- | --- |
| GET | `` | `audit:read` — paginated `items` |
| GET | `/export` | `audit:export` — CSV |
| GET | `/verify` | `audit:verify` — hash chain |

---

## 5. Auth layer (end-to-end)

```
Browser → Vite:5176 → proxy → FastAPI:8000
         Cookie qre_sid (HttpOnly, SameSite=Lax)
         X-CSRF-Token (memory, from /auth/csrf)
```

| Layer | Implementation |
| --- | --- |
| **Login** | `svc02_identity.service.login_local` → `session` row (PostgreSQL), password hash, lockout on `user_credential` |
| **Request context** | `get_ctx` dependency: resolve session → `TenantContext` + permissions |
| **Route guard** | `require_permission("code")`; startup `assert_api_router_guarded` denies unguarded routes |
| **UI gate** | `ProtectedRoute`, `usePermissions`, nav items filtered by `me/navigation` |
| **CAPTCHA** | Redis or in-memory via `captcha.py`; validated on login when `QRE_CAPTCHA_ENABLED` |
| **MFA** | Readiness check + capabilities JSON; full MFA enroll flow UI partially stubbed |

**Frontend auth files:** `auth/AuthContext.tsx`, `auth/ProtectedRoute.tsx`, `api/rbac.ts`, `hooks/useAuthCaptchaRequired.ts`, `components/auth/CaptchaField.tsx`.

---

## 6. Database schema (Alembic + models)

Migrations under `backend/migrations/versions/`:

| Rev | Content |
| --- | --- |
| `0001` | `tenant`, append-only trigger helper |
| `0002` | Identity tables: `app_user`, `user_credential`, `session`, `login_attempt`, … |
| `0003` | RBAC: `role`, `permission`, `role_permission`, `role_assignment`, `project`, `provider` shells |
| `0004` | `audit_log` (hash-chained, append-only) |
| `0005` | RBAC seed data |

**ORM reference:** `backend/qre/services/svc02_identity/models.py` (+ `svc17_audit`).

### Core tables (fields summary)

| Table | Primary key | Notable columns |
| --- | --- | --- |
| `tenant` | `tenant_id` (ULID) | `code`, `name`, `status`, `settings` JSONB, `authz_version` |
| `app_user` | `user_id` | `username`, `email`, `display_name`, `status`, `mfa_enrolled`, `home_tenant_id` |
| `user_credential` | `user_id` | `password_hash`, `failed_count`, `locked_until` |
| `session` | `sid_hash` | `tenant_id`, `principal_id`, `csrf_hash`, `mfa_satisfied`, `last_seen_at`, `revoked_at` |
| `login_attempt` | `attempt_id` | `username_hash`, `ip`, `outcome` |
| `role` / `permission` / `role_permission` | ULIDs | RBAC catalogue |
| `role_assignment` | `membership_id` | `role`, `role_id`, `scope_type`, `scope_id`, `revoked_at` |
| `project` | `project_id` | `code`, `name`, `status`, `row_version` (DDL present; **no project HTTP API yet**) |
| `provider` | `provider_id` | `code`, `name`, `status` (DDL present; **no provider HTTP API yet**) |
| `audit_log` | `audit_id` | `action`, `actor_id`, `target_type`, `target_id`, `outcome`, `correlation_id`, chain fields |

Governance domain tables (workloads, reservations, inventory assets, …) are specified in LLD; **not** all migrated in this repo phase — workspace UI anticipates future services.

---

## 7. Caching

| Data | Store | TTL / behaviour |
| --- | --- | --- |
| **Sessions** | PostgreSQL | Idle + absolute TTL from settings (`session_idle_min`, `session_absolute_h`) |
| **CSRF hash** | PostgreSQL `session.csrf_hash` | Rotated on `/auth/csrf` |
| **CAPTCHA** | Redis JSON or in-memory fallback | Short-lived challenge |
| **Operational cache** | Redis (`core/cache.py`) | Optional; `readyz` reports `cache_redis` |
| **TanStack Query (SPA)** | In-memory per tab | Default `staleTime: 60_000` ms; shell nav badges **90s**; manual refresh invalidates all |
| **Govern notifications** | `localStorage` + server poll | Poll **45s**; `governServerFeed` hits `/governance/summary`, `/approvals?state=*` |

---

## 8. Validation (frontend)

Zod schemas in `frontend/src/lib/validation/schemas.ts`, applied via `parseForm()`:

| Schema | Used on |
| --- | --- |
| `loginSchema` | Login |
| `passwordResetSchema` | Reset password |
| `projectCreateSchema` | `ProjectCreateWizard` |
| `workloadSubmitSchema` | `WorkloadSubmitWizard` |
| `approvalDecisionSchema` | Approval detail decide form |
| `reservationHoldSchema` | Scheduling / holds |
| `assetRegisterSchema` / `assetImportSchema` | Register / import asset |
| `poolCreateSchema` | Pool create modal |
| `projectMemberSchema` | Project members |
| `roleCreateSchema` / `roleEditSchema` | Admin role editor |
| `evidenceLabelSchema` | Evidence snapshots |
| `membershipGrantSchema` | Admin membership grant |

Backend validation: Pydantic on identity/admin routes; problem+json field errors surfaced as `ApiError.fieldErrors` in UI.

---

## 9. Shared frontend architecture

### Shell (every `/qrp/*` route)

| Piece | File | Function |
| --- | --- | --- |
| App shell | `components/layout/chrome.tsx` | Left nav (5 groups), sticky header, breadcrumbs from page context |
| Page chrome API | `components/layout/page-context.tsx` | `useSetPageChrome` |
| Breadcrumbs | `components/layout/Breadcrumbs.tsx` | Crumb trail |
| Page layout | `components/layout/Page.tsx` | `Card`, `MetricTile`, `EmptyState`, `Notice`, optional **contextual** workflow steps |
| Quick dock | `components/shell/QrpQuickActionDock.tsx` | Role shortcuts + summary queries |
| Notifications | `GovernNotificationSync`, `NotificationBell`, `NotificationHost` | Inbox + server feed |
| Layout prefs | `WorkspaceLayoutControls`, `useWorkspacePrefs` | Density, chart size |

### Data / display primitives (reused across pages)

`QueryBody`, `DataState`, `DataTable`/`Table`, `FilterBar`, `KpiStrip`, `ChartPanel`, `CopyableId`, `StatusBadge`, `InfoTip`, `Modal`, `FormField`, `RecordWorkspace`, `ReservationCalendar`, `OverviewDashboardGrid`, `OverviewKpiScroll`, Recharts (`BarChart`, `PieChart`, …).

### Workflow UI

| Component | When |
| --- | --- |
| `WorkflowSteps` / `WorkflowGuide` | Approval **detail**, asset lifecycle, incident detail |
| `ProjectCreateWizard` | Projects list → New project |
| `WorkloadSubmitWizard` | Project hub → submit for review |

---

## 10. Per-route inventory (workspace)

For each route: **shell** is always included (+ ~8 global components). **Approx. unique** = page-specific query count + listed blocks.

### Work

#### `/qrp` — `OverviewPage` (`screens.tsx`)

| | |
| --- | --- |
| **Unique components (~12)** | `OverviewKpiScroll`, `OverviewDashboardGrid`, `ChartPanel`, `MetricTile`×N, `Notice` (lab banner) |
| **APIs (8 queries)** | `/governance/summary`, `/operations/centre`, `/queues`, `/quotas/ledger`, `/dispatch-attempts`, `/alerts/summary`, `/approvals?scope=mine`, `/governance/activity?limit=8` |
| **Data shown** | Role-aware KPI rail; queue/reconcile/jobs/incidents/quota charts; fleet online/offline; recent activity list; links by role focus |
| **Workflow rail** | None (breadcrumbs only) |

#### `/qrp/centre` — `CentrePage`

APIs: `/operations/centre`, `/governance/summary`, `/dispatch-attempts`, `/queues`. KPI tiles, ops summary cards, links to incidents/jobs/reconcile.

#### `/qrp/approvals` — `ApprovalsPage`

APIs: `/governance/summary`, `/approvals` (filtered), `/projects` (seed demo). `FilterBar`, state chart, `DataTable`, seed review mutation.

#### `/qrp/approvals/:workloadId` — `ApprovalDetailPage`

APIs: `/approvals/:id`, `/quotas/evaluate`, decide/withdraw POSTs, related reservations/dispatch. **`WorkflowSteps`** from server trail, `RecordWorkspace` tabs, quota panel, decision form (`approvalDecisionSchema`).

#### `/qrp/approvals/history` — `ApprovalHistoryPage`

API: `/governance/activity?limit=80`. Table of historical decisions.

#### `/qrp/projects` — `ProjectsPage`

APIs: `/projects`, `/governance/summary`, `/approvals`. KPI strip, type bar chart, table/cards toggle, **`ProjectCreateWizard`**.

#### `/qrp/projects/:projectId` — `ProjectDetailPage`

APIs: project, members, approvals, reservations, quota ledger, activity. `RecordWorkspace` (6 tabs), KPI strip, **`WorkloadSubmitWizard`**, charts on overview.

### Resources

#### `/qrp/inventory` — `InventoryPage`

APIs: `/inventory/assets` (+ filters). `FilterBar`, asset table, links to register/import.

#### `/qrp/inventory/new` — `RegisterAssetPage`

POST `/inventory/assets` — `assetRegisterSchema`.

#### `/qrp/inventory/import` — `ImportAssetsPage`

POST `/inventory/imports` — `assetImportSchema`.

#### `/qrp/inventory/:assetId` — `AssetDetailPage`

APIs: asset GET, lifecycle POST. **`steps={LIFECYCLE}`** (asset lifecycle, not governance 1–6).

#### `/qrp/providers` — `ProvidersPage`

API: `/providers`. Provider directory table/cards.

#### `/qrp/providers/:providerId` — `ProviderDetailPage`

Onboarding/transition POSTs, embedded pools/backends context.

#### `/qrp/pools/:poolId`, `/qrp/backends/:backendId`, tabs under inventory

Virtual pools, backends, queues — multiple list/detail APIs (see grep list in §3).

### Compute

#### `/qrp/jobs`, `/qrp/jobs/:jobId`

`/jobs` list/detail.

#### `/qrp/reconciliation` — `ReconciliationPage`

`/dispatch-attempts`, reconcile POST per attempt.

#### `/qrp/support`, `/qrp/incidents`, `/qrp/incidents/:id`, `/qrp/support/:alertId`

Incidents list/detail, alerts summary, alert actions/comments; incident detail may use **`INCIDENT_FLOW`** steps.

#### `/qrp/reservations`, `/qrp/scheduling`

`/reservations` list/create; calendar UI; `reservationHoldSchema`.

#### `/qrp/dispatch` — `DispatchPage`

`/dispatch-icd`, `/dispatch-attempts`, `/jobs`.

### Govern

#### `/qrp/policies` — `PoliciesPage`

`/approvals/policy`, summary.

#### `/qrp/quotas` — `QuotasPage`

`/quotas/ledger` with window/project query params.

#### `/qrp/metering` — `MeteringPage`

`/meter-rollups?hours=`.

#### `/qrp/audit` — `AuditPage`

`/governance/audit-events` (+ export). **Backend gap:** not wired; expect errors in non-lab until module ships.

#### `/qrp/evidence` — redirects to audit; `EvidencePage` uses `/evidence/snapshots`.

### Admin & system

#### `/qrp/admin/users`, roles, permissions routes

**Real APIs:** `api/rbac.ts` → `/admin/*`. Tables, role editor forms, `membershipGrantSchema`.

#### `/qrp/settings` — `SettingsPage`

Institution boundary, links to SLA/notifications/onboarding subpages.

#### `/system/status` — `StatusPage`

`/healthz`, `/readyz`, capabilities panel.

### Public auth

| Route | Page | APIs | Components |
| --- | --- | --- | --- |
| `/` | `LandingPage` | None | `GridPulse`, marketing sections, `SiteFooter` |
| `/login` | `LoginPage` | `capabilities`, `captcha`, `login` | `CaptchaField`, `loginSchema` |
| `/register` | `RegisterPage` | stub / capabilities | |
| `/forgot-password`, `/reset-password` | | reset → **501** | `passwordResetSchema` |
| `/mfa` | `MfaPage` | capabilities | |

---

## 11. React Query keys (cross-cutting)

Examples tied to API reachability:

| Query key | Consumers | API |
| --- | --- | --- |
| `governance-summary` | Shell nav, Home, dock, feed | `/governance/summary` |
| `operations-centre-nav` | Shell badges | `/operations/centre` |
| `nav-reconcile-count` | Shell | `/dispatch-attempts` |
| `projects` | Projects list | `/projects` |
| `project`, `project-approvals`, … | Project detail | per-project paths |

When API missing → `QueryBody` / `DataState` show error or empty; **502** message from `apiReachability`.

---

## 12. How to verify (checklist)

1. `make dev-api` + `make dev-web` (or `scripts/vm-setup.sh`).
2. Open `/system/status` — all readiness checks green; note `cache_redis` and `identity_mfa`.
3. Login — `GET /auth/session` authenticated; CSRF set.
4. Home — with `QRE_ENV=lab`, KPIs populate from stubs; without lab, expect partial **404/502** on module paths.
5. `/qrp/admin/users` — list users from PostgreSQL (real).
6. `GET /api/v1/rbac/audit` — audit rows (real) vs `/qrp/audit` governance events (UI only until implemented).

---

## 13. File index

| Concern | Path |
| --- | --- |
| Routes | `frontend/src/app/router.tsx` |
| Workspace pages | `frontend/src/pages/workspace/screens.tsx`, `continue.tsx` |
| API client | `frontend/src/api/client.ts`, `qre.ts`, `rbac.ts`, `system.ts` |
| Gateway | `backend/qre/gateway/app.py` |
| Identity API | `backend/qre/services/svc02_identity/api.py` |
| Lab stubs | `backend/qre/services/workspace_lab/api.py` |
| Permissions catalogue | `backend/permissions.yaml` |
| Migrations | `backend/migrations/versions/` |

---

## 14. Maintenance

When adding a module router:

1. Mount in `build_api_router()` with `get_ctx` / `require_permission` on every route.
2. Add rows to **§3** (implementation matrix) and the relevant **§10** route section.
3. Extend integration tests; update OpenAPI at `/api/v1/docs`.

When lab stubs are removed, delete `demo: true` assumptions from UI copy and this document’s lab section.