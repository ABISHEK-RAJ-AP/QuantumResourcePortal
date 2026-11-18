# QRP API implementation matrix (code truth)

**Source of truth:** `frontend/src` `qre()` calls vs `backend/qre/services/*/api.py` (Nov 2026).  
**Statuses:** `shipped` = always mounted · `lab` = `workspace_lab` when `QRE_ENV=lab` only · `missing` = UI calls, no router · `admin` = `/api/v1/admin/*`.

Update this file when a vertical slice lands. Reference archaeology stays local (`docs/reference-analysis/`).

---

## Production APIs (always mounted)

| API path | Method | Service | Permission (typical) | DB tables |
| --- | --- | --- | --- | --- |
| `/auth/*`, `/me`, `/me/navigation` | * | svc02 identity | public / session | session, app_user, … |
| `/admin/*` | * | svc02 admin | tenant admin | role, membership, … |
| `/rbac/audit` | GET | svc17 | audit:read | audit_log |
| `/projects` | GET, POST | svc03 | project:read/create | project |
| `/projects/{id}` | GET | svc03 | project:read | project |
| `/projects/{id}/members` | GET, POST | svc03 | project:read / membership:admin | role_assignment |
| `/quotas/ledger` | GET | svc05 | quota:read | workload (approved) |
| `/quotas/evaluate` | GET | svc05 | quota:read | workload metadata |
| `/workload-submissions` | POST | svc06 | workload:create | workload_submission |
| `/workload-submissions/{id}/submit-for-review` | POST | svc06 | workload:submit | workload |
| `/approvals` | GET | svc06 | approval:read | workload |
| `/approvals/{id}` | GET | svc06 | approval:read | workload, decisions |
| `/approvals/{id}/decide` | POST | svc06 | approval:decide | workload |
| `/approvals/{id}/withdraw` | POST | svc06 | workload:withdraw | workload |
| `/governance/summary` | GET | svc06 | governance:read | workload (counts) |
| `/reservations` | GET, POST | svc07 | reservation:read/create | reservation |
| `/reservations/{id}/transition` | POST | svc07 | reservation:* | reservation |
| `/inventory/*`, `/providers`, `/backends` | * | svc04 | inventory/provider | catalogue_*, inventory_asset |
| `/virtual-pools` | * | svc04 | pool:* | virtual_pool |
| `/jobs`, `/dispatch-attempts`, `/dispatch-icd` | * | svc08 | dispatch:* | provider_job, dispatch_attempt |
| `/operations/centre`, `/governance/activity` | GET | svc09 | governance:read | catalogue_*, workload |
| `/meter-rollups` | GET | svc14 | metering:read | workload, jobs |
| `/alerts/*`, `/incidents` | * | svc15 | ops:* | ops_alert, ops_incident |
| `/governance/audit-events` | GET | svc18 | audit:read | audit_log |

**Migrations:** `0001`–`0013`.

### Lab-only ( `QRE_ENV=lab` )

| API path | Notes |
| --- | --- |
| `POST /admin/seed-demo` | PLATFORM_ADMIN · `qre/seed/seed_demo.py` |
| `GET /demo-simulation/status` | Any session · banner + freshness |
| `POST /admin/demo-simulation/*` | PLATFORM_ADMIN · persisted ticks · audit `DEMO_SIM_*` |

---

## Lab-only stubs (`demo: true` on several)

| API path | UI consumers | Replace with |
| --- | --- | --- |
| ~~`/operations/centre`~~ | **shipped** svc09 | SQL fleet + collectors |
| `/queues` | Home, Centre, Jobs, Backends | svc08 dispatch queues |
| `/dispatch-attempts` | Home, Dispatch, Reconcile | svc08 dispatch_attempt |
| ~~`/alerts/summary`~~ | **shipped** svc15 | honest empty |
| ~~`/governance/activity`~~ | **shipped** svc09 | workload history + dispatch |

---

## Missing APIs (UI calls today → **404** outside lab)

Grouped by next service boundary (suggested).

### P0 — governance completion

| API path | UI route / page | Suggested svc | Reference pattern |
| --- | --- | --- | --- |
| ~~`/projects/{id}/members`~~ | **shipped** svc03 | Project detail → Members | ColdFront project users |
| ~~`/quotas/ledger`, `/quotas/evaluate`~~ | **shipped** svc05 | Quotas, approval detail | ColdFront / XDMoD pattern |

### P1 — catalogue & capacity

| API path | UI route | Suggested svc | Reference pattern |
| --- | --- | --- | --- |
| ~~`/inventory/assets` *~~ | **shipped** svc04 | | |
| ~~`/providers`, onboarding, transition~~ | **shipped** svc04 | | |
| ~~`/backends`, `/queues` (catalogue)~~ | **shipped** svc04 | | honest zero pending until svc08 |
| `/backends/{id}/status`, `/topology` | Backend detail | svc04 | read from catalogue JSON |
| ~~`/virtual-pools`~~ | **shipped** svc04 | CRUD + members |
| ~~`/connectors`~~ | **shipped** svc04 | provider BFF + legend |
| ~~`POST /backends`~~ | admin catalogue | **shipped** svc04 |

Reservations **`/reservations`** → **shipped** (svc07). Scheduling page reuses reservations + future timeline BFF.

### P1 — execution

| API path | UI route | Suggested svc | Reference pattern |
| --- | --- | --- | --- |
| ~~`/jobs`, `/jobs/{id}`~~ | **shipped** svc08 | | observations on reconcile |
| ~~`/dispatch-icd`, `/dispatch-attempts`, reconcile~~ | **shipped** svc08 | | authorize + record POSTs |

### P2 — accountability & ops

| API path | UI route | Suggested svc | Reference pattern |
| --- | --- | --- | --- |
| ~~`/meter-rollups`, `/export`~~ | **shipped** svc14 | derived shots + jobs |
| `/reconciliation` (if not client-only) | Reconciliation | svc14 | allocation vs usage |
| ~~`/governance/audit-events`~~ | **shipped** svc18 | maps `audit_log` |
| `/evidence/snapshots` | Audit / evidence | evidence svc | CompanyOS |
| ~~`/incidents`~~ | **shipped** svc15 | lifecycle POSTs |
| `/alerts/*` | **shipped** svc15 | detail/ack (no auto incidents) |
| ~~`/governance/institution-boundary`~~ | **shipped** svc09 | Settings / policies | single-site boundary |
| `/users`, `/users/roles/*` | Legacy settings tabs | **retire** → use `/admin/*` | — |

---

## Frontend route → primary API (quick map)

| Route | Page | Critical APIs | Status |
| --- | --- | --- | --- |
| `/qrp` | OverviewPage | summary, operations/centre, queues, ledger, dispatch, alerts | shipped |
| `/qrp/projects` | ProjectsPage | `/projects` | shipped |
| `/qrp/projects/:id` | ProjectDetailPage | project, **members**, approvals, reservations, ledger, activity | shipped |
| `/qrp/approvals` | ApprovalsPage | `/approvals` | shipped |
| `/qrp/approvals/:id` | ApprovalDetailPage | approval, quotas/evaluate, reservations | shipped |
| `/qrp/reservations` | ReservationsPage | `/reservations` | shipped |
| `/qrp/scheduling` | SchedulingPage | `/reservations` | shipped (timeline UI only) |
| `/qrp/inventory` | InventoryPage | `/inventory/assets` | shipped |
| `/qrp/providers` | ProvidersPage | `/providers` | shipped |
| `/qrp/jobs` | JobsPage | `/jobs` | shipped |
| `/qrp/dispatch` | DispatchPage | dispatch-*, jobs | shipped |
| `/qrp/quotas` | QuotasPage | `/quotas/ledger` | shipped |
| `/qrp/metering` | MeteringPage | `/meter-rollups` | shipped |
| `/qrp/centre` | CentrePage | `/operations/centre` | shipped |
| `/qrp/audit` | AuditPage | audit-events, rbac audit | shipped (governance + rbac) |
| `/qrp/admin/*` | Admin | `/admin/*` | shipped |

---

## Implementation sequence (from matrix)

1. ~~pools/connectors/incidents/backends/institution-boundary~~ → **next:** evidence, alert→incident grouping
2. **P1:** approval audit now writes `APPROVAL_*` to `audit_log`
3. **P2:** `/users` legacy retire; connector live schedules

---

## Verification per slice

- Integration test under `backend/tests/integration/`
- Row updated in this matrix + `FULL_STACK_STATUS.md`
- UI: no silent mock arrays; empty/error when 404
- Permissions match `backend/permissions.yaml`