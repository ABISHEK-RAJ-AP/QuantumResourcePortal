# Quantum Resource Portal (QRP) — AI context pack

**Repository:** `QuantumResourcePortal` (sibling to `Quantum_Monitoring` / Q-TeleScope)  
**Last updated:** 2026-11-19  
**Purpose:** Single onboarding doc for humans and coding agents — product role, tenancy, journeys, every major route, backend map, UI conventions, reference apps, and known gaps.

**Companion docs (deeper slices):**

| Doc | Use when |
| --- | --- |
| [`00_REQUIREMENTS_AND_DESIGN.md`](../00_REQUIREMENTS_AND_DESIGN.md) | SRS/LLD requirement IDs, phase plan |
| [`FULL_STACK_STATUS.md`](./FULL_STACK_STATUS.md) | API truth table, auth, probes, what is stubbed |
| [`WORKSPACE_UI_CATALOG.md`](./WORKSPACE_UI_CATALOG.md) | Per-page UI patterns, breadcrumbs, wizards |
| [`QRP_ORGANIZATION_TENANCY_PLAN.md`](./QRP_ORGANIZATION_TENANCY_PLAN.md) | Org-centric Phase 1/2 |
| [`UI_REFERENCE_BRIDGE.md`](./UI_REFERENCE_BRIDGE.md) | Cert Studio + Q-TeleScope CSS bridge |

---

## 1. What QRP is

**Quantum Resource Portal (QRP)** is the **governance workspace** of the **Quantum Resource Ecosystem (QRE)**. CDAC operates a **shared provider fabric** (QPUs, simulators, HPC, connectors). Each **customer organization** is an isolated **tenant** with its own members, projects, approval policies, quota ledgers, inventory views, dispatch reconciliation, metering, and audit exports.

QRP is **not** a queue UI for raw provider jobs (that is Q-TeleScope). QRP is **policy, capacity, evidence, and org administration** — “who may run what, under which quota, with what audit trail.”

**Operator density:** Console UI follows Q-TeleScope ops patterns (tables, KPI strips, freshness, manual refresh). **Access and registration** follow **Cert Studio** (organization register, People & access, settings sidebars).

---

## 2. Roles and personas

| Persona | Typical permissions | Primary surfaces |
| --- | --- | --- |
| **Platform operator (CDAC)** | CDAC tenant; provider/inventory/catalog ops | Home, Operations, Providers, Connectors (lab), demo seed |
| **Organization admin** | `user:*`, `role:*`, org settings | Organization hub, People & access, Settings |
| **Approver** | `approval:decide`, `governance:read` | Approvals queue & detail, Policies |
| **Researcher / submitter** | `workload:create`, `project:read` | Projects, submit workload wizard, approval status |
| **Auditor** | `audit:read`, `audit:export` | Audit & Evidence, RBAC audit export |
| **Capacity owner** | `quota:*`, reservations | Quotas, Metering, Reservations, Scheduling |

Navigation visibility is **server-driven** (`GET /me/navigation`, `GET /me/permissions`). The UI gates routes with `ProtectedRoute` but **must not** be the only enforcement layer.

---

## 3. Tenancy and domain model

```
Platform (CDAC deployment)
 └── Organization (tenant: tenant_code, tenant_name)
      ├── Members (app_user + role_assignment)
      ├── Projects (optional work containers)
      │    └── Workloads → Approval cycles → Authorise → Dispatch attempts
      ├── Quota ledger (dimension: tenant; project drill-down optional)
      ├── Inventory/assets (org-scoped visibility)
      └── Audit / governance events (append-only)
```

**Phase 1 (shipped):** Lab self-registration `POST /api/v1/auth/register-organization` when `QRE_ORG_SELF_REGISTER=true`; Cert-style `/register`; `/qrp/organization` hub; org-first copy on quotas/metering.

**Phase 2 (backlog):** Email invites, join-existing-org, platform org approval console, multi-org `tenant-switch` UI.

---

## 4. Primary use cases

1. **Onboard organization** — Register org + first admin → login → invite members (Phase 2) via People & access.
2. **Govern a workload** — Create project → submit workload → multi-stage approval → quota evaluate at decide → authorise → dispatch attempt → reconcile if needed → evidence on audit trail.
3. **Explain capacity** — Org quota ledger, reservations/holds, metering rollups; answer “why was this rejected?”
4. **Operate fleet context** — Catalogue assets, providers, pools, backends; link to jobs/dispatch (read-heavy in current slice).
5. **Prove compliance** — Export governance/RBAC audit chains; correlate dispatch attempts and decisions.

---

## 5. Runtime topology

| Process | URL (dev) | Notes |
| --- | --- | --- |
| Vite SPA | `http://localhost:5176` | Proxies `/api`, `/healthz`, `/readyz` → backend |
| FastAPI gateway | `http://127.0.0.1:8010` | `/api/v1/*` |
| PostgreSQL | `DATABASE_URL` | Alembic migrations |
| Redis (optional) | `QRE_REDIS_URL` | CAPTCHA + cache; not session store |

**Session:** Cookie `qre_sid` + in-memory CSRF from `GET /api/v1/auth/csrf` after login.

---

## 6. Frontend architecture

| Layer | Path | Responsibility |
| --- | --- | --- |
| Router | `frontend/src/app/router.tsx` | Public vs `RequireAuth` + `AppShell` |
| Shell | `frontend/src/components/layout/chrome.tsx` | Left nav groups, header, breadcrumbs, badges |
| Page chrome | `components/layout/Page.tsx`, `page-context.tsx` | Title, crumbs, actions, `DataFreshness` |
| Data | React Query + `qre()` client | `/api/v1` module calls |
| Auth | `auth/*`, `RequireAuth`, `ProtectedRoute` | Session probe, permission gates |
| Workflow UI | `components/workflow/*` | Project create wizard, workload submit wizard, step rails on **detail** pages only |
| Marketing | `pages/public/LandingPage.tsx`, `public-landing.css` | No app nav; standardized section grid (no marketing bento) |
| Styles bridge | `ref-ui-bridge.css`, `org-studio.css`, `craft-ops.css` | Cert + TeleScope density |

**Nav groups** (`chrome.tsx`):

- **Work:** Home, Operations, Approvals, Projects  
- **Resources:** Resources (inventory), Facilities & Providers  
- **Compute:** Jobs & Queues, Dispatch reconcile, Incidents, Reservations  
- **Govern:** Policies, Quotas, Metering, Audit & Evidence  
- **Organization:** Organization hub, People & access  
- **Admin:** Settings  

Badge keys: `approvals`, `reconcile`, `alerts`, `incidents` (polled ~90s).

---

## 7. Route catalog

### 7.1 Public (unauthenticated)

| Path | Component | Purpose |
| --- | --- | --- |
| `/` | `LandingPage` | Marketing: hero, capabilities, modules, workflow, FAQ, CTA |
| `/login` | `LoginPage` | Username/password, optional CAPTCHA |
| `/register` | `RegisterPage` | Organization self-register (lab flag) |
| `/forgot-password` | `ForgotPasswordPage` | Reset request |
| `/reset-password` | `ResetPasswordPage` | Token reset |
| `/mfa` | `MfaPage` | MFA challenge when enabled |
| `/legal/privacy`, `/legal/terms` | `LegalPage` | Legal copy |

`PublicOnly` redirects authenticated users to `/qrp`.

### 7.2 Authenticated workspace (`AppShell`)

| Path | Component | Domain |
| --- | --- | --- |
| `/qrp` | `OverviewPage` | Home / governance dashboard |
| `/qrp/centre` | `CentrePage` | Operations centre |
| `/qrp/approvals` | `ApprovalsPage` | Review queue |
| `/qrp/approvals/history` | `ApprovalHistoryPage` | Closed decisions |
| `/qrp/approvals/:workloadId` | `ApprovalDetailPage` | Decide, trail, step rail |
| `/qrp/projects` | `ProjectsPage` | Project list + create wizard |
| `/qrp/projects/:projectId` | `ProjectDetailPage` | Hub + workload submit wizard |
| `/qrp/inventory` | `InventoryPage` | Asset catalogue (tabs: backends, pools, …) |
| `/qrp/inventory/register` | `RegisterAssetPage` | Single/bulk register |
| `/qrp/inventory/:assetId` | `AssetDetailPage` | Lifecycle step rail |
| `/qrp/pools/:poolId` | `PoolDetailPage` | Pool record |
| `/qrp/providers` | `ProvidersPage` | Provider list |
| `/qrp/providers/onboarding` | `OnboardingPage` | Provider onboarding |
| `/qrp/providers/:providerId` | `ProviderDetailPage` | Provider + connectors embed |
| `/qrp/connectors` | `ConnectorsPage` | Connector catalogue |
| `/qrp/policies` | `PoliciesPage` | Approval policies |
| `/qrp/quotas` | `QuotasPage` | Org quota ledger |
| `/qrp/reservations` | `ReservationsPage` | Holds list |
| `/qrp/scheduling` | `SchedulingPage` | Request holds |
| `/qrp/metering` | `MeteringPage` | Usage views |
| `/qrp/sla` | `SlaPage` | SLA targets/breaches |
| `/qrp/audit` | `AuditPage` | Governance audit stream |
| `/qrp/support` | `SupportPage` | Support / alerts entry |
| `/qrp/incidents` | `IncidentsPage` | Incidents list |
| `/qrp/incidents/:incidentId` | `IncidentDetailPage` | Incident step rail |
| `/qrp/support/:alertId` | `AlertDetailPage` | Alert record |
| `/qrp/jobs` | `JobsPage` | Jobs & queues |
| `/qrp/jobs/:jobId` | `JobDetailPage` | Job detail |
| `/qrp/backends/:backendId` | `BackendDetailPage` | Backend record |
| `/qrp/reconciliation` | `ReconciliationPage` | Manual dispatch reconcile |
| `/qrp/dispatch` | `DispatchPage` | Dispatch monitor |
| `/qrp/notifications` | `NotificationsPage` | In-app notifications |
| `/qrp/procurement` | `ProcurementPage` | Procurement refs (flagged) |
| `/qrp/entitlements` | `EntitlementsPage` | Entitlements (flagged) |
| `/qrp/organization` | `OrganizationHubPage` | Org overview (Cert org hub) |
| `/qrp/settings` | `SettingsPage` | Workspace settings |
| `/qrp/profile` | `ProfilePage` | User profile |
| `/qrp/admin/users` | `UsersAdminPage` | People & access |
| `/qrp/admin/users/:userId` | `UserPermissionsPage` | Per-user grants |
| `/qrp/admin/roles` | `RolesPage` | Role list |
| `/qrp/admin/roles/new`, `.../:roleId` | `RoleEditorPage` | Role editor |
| `/qrp/admin/permissions` | `PermissionsPage` | Permission catalogue |
| `/403` | `AccessDeniedPage` | Permission denied |

**Redirects:** `/qrp/evidence` → audit; inventory import/new → register wizard; settings organization → `/qrp/organization`; legacy `/qrp/users` → admin users.

### 7.3 System (may be framed in shell)

| Path | Component | Purpose |
| --- | --- | --- |
| `/system/status` | `StatusPage` | `/healthz` + `/readyz` + capabilities |

---

## 8. Backend architecture

**Entry:** `backend/qre/gateway/app.py` mounts versioned `api_router`.

| SVC | Package | Router prefix (typical) | Responsibility |
| --- | --- | --- | --- |
| SVC-01 | `gateway/` | `/healthz`, `/readyz` | Liveness, readiness, correlation |
| SVC-02 | `svc02_identity/` | `/api/v1/auth/*`, `/me`, `/admin/*` | Login, sessions, RBAC admin, **org register**, `/me/organization` |
| SVC-03 | `svc03_projects/` | `/api/v1/projects` | Projects CRUD, members |
| SVC-04 | `svc04_inventory/` | `/api/v1/inventory/*`, providers, pools, backends, connectors | Asset catalogue, provider registry |
| SVC-05 | `svc05_quotas/` | `/api/v1/quotas/*` | Ledger, evaluate |
| SVC-06 | `svc06_approvals/` | workloads, `/approvals`, `/governance/summary` | Approval queue, decide, withdraw |
| SVC-07 | `svc07_scheduling/` | `/api/v1/reservations` | Scheduling holds |
| SVC-08 | `svc08_dispatch/` | jobs, dispatch attempts, reconcile | Execution records (QRP-facing) |
| SVC-09 | `svc09_ops/` | operations centre | Ops KPIs, activity |
| SVC-14 | `svc14_metering/` | metering rollups | Usage |
| SVC-15 | `svc15_alerts/` | alerts, incidents | Ops alerts |
| SVC-17 | `svc17_audit/` | `/api/v1/rbac/audit` | RBAC audit chain |
| SVC-18 | `svc18_governance_audit/` | `/api/v1/governance/audit-events` | Governance audit |
| Lab | `workspace_lab/`, demo routers | `/admin/seed-demo`, simulation | **Lab only** |

**Authoritative “what is real” list:** [`FULL_STACK_STATUS.md`](./FULL_STACK_STATUS.md) §3–4 and `docs/development/QRP_API_IMPLEMENTATION_MATRIX.md` if present.

**Org registration (Phase 1):**

- `POST /api/v1/auth/register-organization` → `org_register.py` / `bootstrap_admin`
- `GET /api/v1/me/organization` → org profile for hub
- Flag: `QRE_ORG_SELF_REGISTER`
- Tests: `backend/tests/integration/test_org_register.py`

---

## 9. Authentication and authorization (agent checklist)

1. Public routes listed in `PUBLIC_API_SUFFIXES` (login, capabilities, captcha, register-organization when enabled).
2. Unsafe methods need `X-CSRF-Token` header matching session.
3. `ProtectedRoute` checks permission strings like `user:read`, `approval:decide`.
4. **Server must reject** unauthorized API calls even if UI is bypassed.
5. Separation of duties: approvers should not decide own submissions (enforced in approvals service).

---

## 10. UI patterns (Cert Studio + Q-TeleScope)

**From Cert Studio** (`/home/boss/Desktop/CEG-WorkshopOS-CertStudio/Certificate/Cert-Studio/cert-studio-frontend/`):

- Multi-step **register** (`cert-register-steps*`)
- **Settings** sidebar tabs; **Organization** / people hubs
- **PublicLayout** + marketing footer (QRP: `PublicShell` + `LandingChrome`)
- Dashboard bento is **workspace-only** in Cert — QRP **does not** copy marketing bento on landing (uniform section grids instead)

**From Q-TeleScope** (shared theme in `Quantum_Monitoring` / `apps/shared/qre-theme`):

- IBM Plex, primary indigo + brand cyan
- `page-stack` width, table density, ops KPI cards
- `GridPulse` background on landing (theme-aware via `--primary` / `--brand-cyan`)

**Workflow rules:**

- **List/hub pages:** breadcrumbs only — no global six-step rail.
- **Detail pages:** contextual step rail (approval, asset, incident, job where implemented).
- **Wizards in dialogs:** `ProjectCreateWizard`, `WorkloadSubmitWizard` (Cert-style Back/Next).

---

## 11. Key file map for agents

| Task | Files |
| --- | --- |
| Add route | `frontend/src/app/router.tsx`, page under `pages/workspace/` or `pages/public/` |
| Nav item | `frontend/src/components/layout/chrome.tsx` `NAV` + backend navigation if permission-gated |
| API module | `backend/qre/services/svcNN_*/api.py`, register in `gateway/app.py` |
| Landing/marketing | `LandingPage.tsx`, `public-landing.css`, `grid-pulse.tsx` |
| Org UX | `OrganizationHubPage.tsx`, `RegisterPage.tsx`, `org-studio.css` |
| Approvals | `svc06_approvals/`, `ApprovalsPage.tsx`, `ApprovalDetailPage.tsx` |
| Theme tokens | `frontend/src/styles/index.css` |

---

## 12. Implementation status (high level)

| Area | Status |
| --- | --- |
| Identity, sessions, RBAC admin | Shipped |
| Org self-register (lab) | Shipped |
| Projects, workloads, approvals (minimal queue) | Shipped |
| Quotas ledger + evaluate | Shipped |
| Reservations holds | Shipped |
| Dispatch jobs + reconciliation | Shipped (lab/demo depth varies) |
| Inventory/providers/pools/backends | Shipped (breadth varies by seed) |
| Metering, ops centre, alerts | Shipped / lab-enriched |
| Procurement SVC-05 | Behind feature flag / 501 |
| Evidence snapshots (some paths) | Partial — check matrix |
| Email invites, platform org approval | Phase 2 |

---

## 13. Verification commands

```bash
cd /path/to/QuantumResourcePortal/frontend && npm run typecheck
cd /path/to/QuantumResourcePortal/backend && pytest tests/integration/test_org_register.py -q
# Full dev: make dev-api + make dev-web (see repo Makefile)
```

Manual smoke: `/` landing → `/register` → login → `/qrp/organization` → submit path via project → `/qrp/approvals`.

---

## 14. Agent editing principles

- **Smallest diff**; match existing shell and Cert bridge classes.
- **Org-first copy** on capacity and governance surfaces.
- **No marketing bento** on `/` — equal cards in a regular grid.
- **Do not** invent API fields; align with `FULL_STACK_STATUS.md` or read handler code.
- After non-trivial code changes in TeleScope monorepo sibling, `graphify update` applies only inside repos that use graphify; QRP may not have `graphify-out/` — grep before running.

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| QRE | Quantum Resource Ecosystem (platform) |
| QRP | Govern workspace (this app) |
| Tenant | Organization |
| Workload | Unit submitted for approval / dispatch |
| Governance state | Approval lifecycle on a workload |
| Shot ledger | Quota consumption unit (org-scoped) |
| Dispatch attempt | Authorise → provider execution record |

---

*End of AI context pack. For landing content strings, see `frontend/src/pages/public/LandingPage.tsx`.*