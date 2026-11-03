# QRP — Requirements Analysis, Implementation Mapping and Design Concept

**Project:** Quantum Resource Portal (QRP), the *Govern* workspace of the Quantum Resource Ecosystem (QRE)
**Phase:** 0 (analysis, before code) · **Date:** 02-Nov-2026
**Sources (in order of precedence for implementation detail):**

| Ref | Document | Use in this project |
|---|---|---|
| LLD | Low-Level Design v1.1.0 (26-Oct-2026), "Final_LLD_Reviewed" | Authoritative for modules, tables (Appendix B DDL), endpoints (§8.2), error codes (Appendix C), config (Appendix D), audit actions (Appendix F), RBAC (§11.2) |
| HLD | High-Level Design v1.1.0 (26-Oct-2026) | Architecture principles, service catalogue, tenancy, approval state machine |
| SRS | Software Requirements Specification v1.0.0 (09-Oct-2026) | Requirement IDs (REQ-028 … REQ-046), role matrix (Appendix B), invariants |

Where the master prompt and the LLD disagree, **the LLD wins** (master prompt §5, §6, §14 rule 2) and the difference is listed in §6 below.

---

## 1. QRP scope in one paragraph

QRP is the governance workspace: a resource inventory (QPUs, simulators, plant, control electronics, HPC, storage, software), provider onboarding with versioned capability manifests, procurement references and entitlements (**pending approval**, feature-flagged), configurable multi-stage approvals with append-only decisions, quota evaluation with holds, reservations that never authorise dispatch on their own, dispatch attempts and manual reconciliation (SVC-08 surfaces QRP needs), metering, SLA records, support tickets, audit and notifications. QRE is an index and governance layer: providers remain authoritative for execution and queue state, and QRE never invents missing metrics (HLD §2.1).

### Classification of services in scope

| Service | LLD § | Classification | How it is treated |
|---|---|---|---|
| SVC-01 Gateway / CORE | 4.1, 4.2 | Committed | Built in Phase 1 (correlation, errors, health) and Phase 3/8 (auth, CSRF, rate limits) |
| SVC-02 Identity | 4.3 | Committed (MFA/federation optional per profile) | Local login (Argon2id), server sessions, RBAC. OIDC/SAML/TOTP deferred and disclosed |
| SVC-03 Provider & Resource Registry | 4.4 | Committed | Full |
| SVC-04 Inventory & Asset Mgmt | 4.5 | Committed | Full incl. two-phase bulk import |
| **SVC-05 Procurement & Entitlements** | 4.6 | **Pending Approval (GAP-010, OI-01)** | Built behind `QRE_FEATURE_SVC05_ENABLED` (default `false` → HTTP 501 `FEATURE_NOT_ENABLED`); quota limits come from `quota_ledger.limit_amount` while disabled |
| SVC-06 Approvals & Quota | 4.7 | Committed | Full state machine, policies, quota, escalation |
| SVC-07 Scheduling & Reservations | 4.8 | Committed | Full incl. GiST exclusion constraint |
| SVC-08 Dispatch (QRP-facing parts) | 4.9 | Committed | Attempt records, authorise→dispatch guard, manual reconciliation page. Only a non-hardware demo connector is registered |
| SVC-14 Metering & SLA | 4.15 | Committed | Full; reports via CSV/PDF when enabled |
| SVC-15 Support & Incidents | 4.16 | Optional (no SRS REQ) | Local tickets; ITSM sync only when a connector is registered |
| SVC-17 Audit & Notification | 4.18 | Committed | Append-only hash-chained audit, in-app notifications |

Out of QRP scope (other workspaces): SVC-09/10 (Q-Forge build), SVC-11/12/13 (Q-TeleScope), SVC-16 (site-configured evidence), SVC-19/20 (planned).

---

## 2. Requirement-to-implementation mapping

Paths are under `/api/v1`. "Phase" refers to the execution plan in §8.

| Capability | SRS REQ | LLD module / functions | API (LLD §8.2) | Tables (LLD App. B) | Frontend route | Tests (LLD ch. 14) | Phase |
|---|---|---|---|---|---|---|---|
| Health, docs, correlation, error envelope | REQ-003, V001, N022 | CORE, SVC-01 | API-SYS-01 `/healthz`, `/readyz`, `/api/v1/docs`, `/api/v1/openapi.json` | — | `/system/status` | TC-GW-001 | **1** |
| Login / logout / session / me / navigation | REQ-001, 002, 005, 006, 007, N011, N013, N014 | SVC-02 FN-IAM-01/03/05/06 | API-IAM-01 `POST /auth/login`, API-IAM-05 `POST /auth/logout`, `POST /auth/tenant-switch`, API-IAM-06 `GET /me`, `GET /me/navigation` | tenant, app_user, user_credential, role_assignment, session, login_attempt | `/login`, header, sidebar | TC-IAM-001…010, TC-SHL-001…003 | 3 |
| Tenant isolation | REQ-009, N012 | CORE BaseRepository, (RLS PD-44 optional) | all | `tenant_id` on every table | — | TC-IAM-009, TC-DAT-* | 3 (+ every phase) |
| User & role administration | REQ-006 | SVC-02 grant_role/revoke_role | API-IAM-07 `/admin/memberships` | role_assignment, app_user | `/qrp/admin/users` | TC-IAM-010 | 7 |
| Governance dashboard | REQ-028, 029, 030 | SVC-06 governance_summary | API-GOV-01 `GET /governance/summary` | aggregates (workload, approval_cycle, quota_ledger, provider, backend, connector, reservation, asset, usage_record) | `/qrp` | TC-QRP-001 | 3 (shell) → 6 (all widgets) |
| Asset CRUD, search, filters | REQ-031, 032 | SVC-04 create_asset, update_asset, search_assets | API-INV-01 `/assets`, `/assets/{id}` | asset | `/qrp/inventory`, `/qrp/inventory/:assetId` | TC-QRP-002 | 4 |
| Bulk import (validate → preview → commit) | REQ-032 | SVC-04 FN-INV-01 | API-INV-02 `/assets/imports`, `/assets/imports/{job}/commit`; API-INV-03 `/assets/import-templates/{version}` | asset_import_job, asset | `/qrp/inventory/import` | TC-QRP-003 | 4 |
| Declared topology | REQ-033 | SVC-04 FN-INV-02 | API-INV-04 `/backends/{id}/topology` | topology_edge | asset detail → Topology tab | TC-TEL-005 | 4 |
| Provider registry, onboarding, manifests | REQ-035, 036, 030 | SVC-03 FN-REG-01/02, submit_onboarding | API-PRV-01 `POST /providers`, API-PRV-02 `POST /providers/{id}/onboarding`, API-PRV-03 `PATCH /providers/{id}/state` | provider, provider_manifest, backend | `/qrp/providers`, `/qrp/providers/:id`, `/qrp/providers/onboarding` | TC-QRP-005, 006 | 4 |
| Connector status (read) | REQ-025, 027, N021 | SVC-03 | API-CON-01 `GET /connectors` | connector, connector_conformance_run | provider detail → Connectors tab | TC-CON-* | 4 |
| Procurement references | REQ-034 | SVC-05 create_reference, link_asset/project | API-PRC-01 `/procurement-refs`, API-PRC-02 `/procurement-refs/{id}/links` | procurement_ref, asset_procurement_link | `/qrp/procurement` | TC-QRP-004 | 5 (flagged) |
| Entitlements | REQ-034, 042 | SVC-05 grant_entitlement | API-PRC-03 `/projects/{id}/entitlements` | entitlement | `/qrp/entitlements` | TC-QRP-017 | 5 (flagged) |
| Workload request (Draft created in QRP) | REQ-057; SRS §4.12 state table ("Created in QTarka or QRP") | SVC-06 | API-WKL-01 `/workloads`, API-WKL-03 `/workloads/{id}/submit|withdraw|reopen` | workload, project | `/qrp/approvals/new` | TC-QRP-007 | 5 |
| Approval queue / detail / decision | REQ-037, 039, 040, 041 | SVC-06 FN-APR-01/02, WorkloadStateMachine | API-APR-01 `GET /approvals`, API-APR-02 `GET /approvals/{cycle_id}`, API-APR-03 `POST /approvals/{cycle_id}/stages/{stage_id}/decision` | approval_cycle, approval_decision (append-only trigger), workload | `/qrp/approvals`, `/qrp/approvals/:cycleId`, `/qrp/approvals/history` | TC-QRP-007, 010, 011, 013 | 5 |
| Approval policies (versioned) | REQ-037, 043 | SVC-06 publish_policy | API-APR-05 `/approval-policies` | approval_policy | `/qrp/policies` | TC-QRP-013 | 5 |
| Quota evaluation, holds, authorise | REQ-042 | SVC-06 FN-APR-03/04 | API-APR-04 `POST /workloads/{id}/authorize` (+ ledger endpoints, see D-07) | quota_ledger, quota_hold, quota_evaluation | `/qrp/quotas` | TC-QRP-011, 012 | 5 |
| Escalation on stage timeout | REQ-043 | SVC-06 FN-APR-05 (worker) | — | approval_cycle.escalated_at, notification, job_queue | notification panel | TC-QRP-013 | 5 |
| Reservations, conflicts, windows | REQ-038 | SVC-07 FN-SCH-01, check_window | API-SCH-01 `/reservations` | reservation (exclusion constraint) | `/qrp/scheduling` (calendar), `/qrp/reservations` (list) | TC-QRP-008 | 6 |
| Dispatch guard & attempts | REQ-039, 064, N040 | SVC-08 FN-EXE-01 | API-EXE-01 `POST /workloads/{id}/dispatch`, API-EXE-02 `/workloads/{id}/dispatch-attempts`, API-EXE-04 device-options | dispatch_attempt (partial unique index), external_job_handle | approval detail → Dispatch panel | TC-QRP-009, TC-EXE-* | 6 |
| Manual reconciliation | REQ-R006 | SVC-08 FN-EXE-04 | API-EXE-03 `/dispatch-attempts?status=MANUAL_REVIEW`, `/dispatch-attempts/{id}/resolve` | dispatch_attempt | `/qrp/reconciliation` | TC-EXE-008 | 6 |
| Usage metering | REQ-044, N041 | SVC-14 record_usage, FN-MTR-01 | API-MTR-01 `/usage`, `/usage/aggregate` | usage_record (+ quota_ledger.consumed) | `/qrp/metering` | TC-QRP-014 | 6 |
| SLA targets & breaches | REQ-045 | SVC-14 FN-MTR-02, record_restoration | API-MTR-02 `/sla-targets`, `/sla-breaches` | sla_target, sla_breach | `/qrp/sla` | TC-QRP-015 | 6 |
| Utilisation reports CSV/PDF | REQ-046 | SVC-13 renderers via SVC-14 | API-RPT-01 `/reports`, `/reports/{id}/download` | report_job | export actions on metering/SLA | TC-QRP-016 | 6 / 8 |
| Support tickets | (SVC-15, GAP-035) | SVC-15 create_ticket, update_ticket | API-SUP-01 `/tickets` | ticket, ticket_event | `/qrp/support`, `/qrp/support/:ticketId` | integration | 6 |
| Audit log | REQ-008 | SVC-17 FN-AUD-01, search_audit, verify_chain | API-AUD-01 `/audit`, `/audit/verify` | audit_log (append-only, partitioned) | `/qrp/audit` | TC-AUD-001, 002 | 3 (writer) → 7 (UI) |
| Notifications | REQ-043 | SVC-17 notify | (no read endpoint in catalogue — see D-05) | notification | header panel, `/qrp/notifications` | — | 7 |
| Status text labels, accessibility | REQ-004, N031 | FE ui-kit | — | — | all | TC-UI-* | 2 |

### Role-based navigation (server-derived, REQ-002)

Each sidebar item is returned by `GET /me/navigation` only if `Authorizer.can(ctx, action)` is true (LLD FN-IAM-06). The UI never decides visibility on its own; the server also enforces every action.

| Sidebar item | Route | Required action (permissions.yaml) |
|---|---|---|
| Governance Dashboard | `/qrp` | `governance:read` |
| Resource Inventory | `/qrp/inventory` | `asset:read` |
| Import Assets *(replaces "Asset Details", see D-11)* | `/qrp/inventory/import` | `asset:write` |
| Providers | `/qrp/providers` | `provider:read` |
| Provider Onboarding | `/qrp/providers/onboarding` | `provider:manifest:write` |
| Procurement | `/qrp/procurement` | `procurement:read` + SVC-05 flag |
| Entitlements | `/qrp/entitlements` | `procurement:read` + SVC-05 flag |
| Approval Requests | `/qrp/approvals` | `approval:read` |
| Approval History | `/qrp/approvals/history` | `approval:read` |
| Quotas | `/qrp/quotas` | `quota:read` |
| Policies | `/qrp/policies` | `policy:read` |
| Scheduling | `/qrp/scheduling` | `reservation:read` |
| Reservations | `/qrp/reservations` | `reservation:read` |
| Usage Metering | `/qrp/metering` | `usage:read` |
| SLA Management | `/qrp/sla` | `sla:read` |
| Support & Incidents | `/qrp/support` | `ticket:read` |
| Reconciliation | `/qrp/reconciliation` | `dispatch:reconcile` |
| Audit Logs | `/qrp/audit` | `audit:read` |
| Notifications | `/qrp/notifications` | authenticated |
| User Management | `/qrp/admin/users` | `membership:admin` |
| Settings | `/qrp/settings` | authenticated (profile) / `PLATFORM_ADMIN` (system) |

---

## 3. Role model

The master prompt names six demo roles; the LLD (§4.3.1, §11.2) defines the authoritative role codes. Mapping used:

| Master-prompt role | LLD role code | Scope | Notes |
|---|---|---|---|
| Platform Administrator | `PLATFORM_ADMIN` | Tenant | Provider state transitions, connectors, policies, memberships |
| Resource Manager | `RESOURCE_MANAGER` | Tenant | Asset and procurement write (CF-09 / NF-01: pending confirmation in SRS) |
| Principal Investigator | `PROJECT_OWNER` | Project | Stage-1 approvals, project membership, dispatch of own project |
| Approver | `QUOTA_APPROVER` | Tenant | Stage-2 (quota/policy) approvals, re-authorise |
| Researcher | `RESEARCHER` | Project | Creates and submits workload requests; cannot approve |
| Auditor | `AUDITOR` | Tenant | Read-only everywhere, audit read/export |
| *(additional, needed for flows)* | `PROVIDER_ADMIN` | Provider | Onboarding packages and manifests for own provider (REQ-035) |
| *(additional, needed for flows)* | `OPERATOR` | Tenant | Manual reconciliation (REQ-R006) |

Segregation of duties: a submitter can never decide any stage of their own workload (`SOD_VIOLATION`, PD-25).

---

## 4. Proposed folder structure

The LLD (§6.1, §13.3) organises the backend as vertical service slices (`services/svcNN_<name>/{api,schemas,models,repository,service}.py`). The master prompt suggests horizontal folders (`models/`, `schemas/`, `services/…`). Both put a service boundary around each SVC; the LLD layout is kept because LLD §2.9 requires that other modules import only a service's `service.py` (enforced by import-linter).

```
quantum-resource-portal/
├── README.md
├── Makefile                         # common commands (make dev-api, make test …)
├── .gitignore  .editorconfig
├── .vscode/                         # settings.json, extensions.json, launch.json
├── docs/
│   ├── 00_REQUIREMENTS_AND_DESIGN.md   # this document
│   ├── PHASE_1_GUIDE.md                # step-by-step build guide
│   └── DECISIONS.md                    # decision log (D-xx)
├── backend/
│   ├── pyproject.toml               # tool config (pytest, ruff)
│   ├── requirements.txt             # pinned runtime deps
│   ├── requirements-dev.txt         # pinned test/lint deps
│   ├── .env.example                 # Appendix D variables
│   ├── alembic.ini
│   ├── migrations/                  # Alembic env + versions/ (Appendix B DDL, split per phase)
│   ├── permissions.yaml             # role → action matrix (LLD §11.2)       [Phase 3]
│   ├── qre/
│   │   ├── main.py                  # ASGI entry point: `uvicorn qre.main:app`
│   │   ├── core/                    # shared kernel (LLD §4.1)
│   │   │   ├── config.py  ids.py  errors.py  db.py  logging.py
│   │   │   ├── context.py authz.py pagination.py idempotency.py outbox.py   [Phase 3]
│   │   ├── gateway/                 # SVC-01 (LLD §4.2)
│   │   │   ├── app.py  problem.py  health.py
│   │   │   └── middleware/  correlation.py  (auth.py ratelimit.py size.py — Phase 3/8)
│   │   ├── services/
│   │   │   ├── svc02_identity/  svc03_registry/  svc04_inventory/  svc05_procurement/
│   │   │   ├── svc06_approvals/ svc07_scheduling/ svc08_dispatch/  svc14_metering/
│   │   │   ├── svc15_support/   svc17_audit/
│   │   │   │   └── each: api.py schemas.py models.py repository.py service.py policies.py tasks.py
│   │   ├── connectors/              # base.py manifest.py adapters/demo_noop/       [Phase 4/6]
│   │   └── workers/                 # job_queue runner, sweepers, beat schedule     [Phase 5]
│   ├── seeds/                       # DEMO DATA seed (separate demo tenant)          [Phase 3+]
│   └── tests/  unit/ integration/ security/
└── frontend/
    ├── package.json  vite.config.ts  tsconfig*.json  components.json  eslint.config.js
    ├── index.html
    ├── e2e/                         # Playwright specs
    └── src/
        ├── main.tsx  app/ (App.tsx, providers.tsx, router.tsx)
        ├── api/        # fetch client: CSRF header, problem+json → ApiError, 401 handling
        ├── components/ layout/ ui/ (shadcn) charts/ tables/ forms/ dialogs/ status/
        ├── pages/      dashboard/ inventory/ providers/ procurement/ approvals/ quotas/
        │               scheduling/ metering/ sla/ support/ audit/ settings/ system/
        ├── hooks/  contexts/  types/  lib/ (utils, format)  routes/
        └── styles/ index.css (design tokens)
```

Frontend: one Vite app serves the shell (`/login`) and the QRP workspace (`/qrp/*`). LLD §13.3 proposes a monorepo of four SPAs plus shared packages; building only QRP now, a single app with the same internal split (`components/ui` ≈ `packages/ui-kit`, `api/` ≈ `packages/api-client`) keeps the later split mechanical (D-10).

---

## 5. UI design concept

### 5.1 Design tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Cards, header, sidebar |
| `--surface` | `#F7F9FC` | Page background, table header rows |
| `--primary` | `#536DFE` | Primary actions, active nav, focus ring, chart series 1 |
| `--secondary` | `#7957E8` | Secondary emphasis, chart series 2, gradient end |
| `--accent` | `#20B8D5` | Highlights, simulator series, info badges |
| `--foreground` | `#172033` | Body text, headings |
| `--muted-foreground` | `#788397` | Labels, captions, axis text |
| `--border` | `#E8ECF3` | Card borders, dividers, inputs |
| `--success` | `#16A36A` | ACTIVE / APPROVED / CONFIRMED |
| `--warning` | `#E9A23B` | IN_REVIEW / DEGRADED / TENTATIVE |
| `--critical` | `#E05252` | REJECTED / UNREACHABLE / BREACH |
| Radius | 12 px cards, 8 px controls, full for badges | |
| Shadow | `0 1px 2px rgb(23 32 51 / .04), 0 4px 16px rgb(23 32 51 / .06)` | Cards; raised by one step on hover |
| Typography | **Inter** (UI, tabular numerals for figures), **JetBrains Mono** (IDs, ULIDs, native IDs) | 14 px body, 12 px captions, 24/30 px page titles |
| Gradient | `linear-gradient(135deg, #536DFE, #7957E8)` | Only: logo mark, primary KPI accent bar, login hero |

Text colour on `--primary` meets WCAG AA for ≥14 px semibold (white on #536DFE ≈ 4.6:1). `--muted-foreground` on white ≈ 4.0:1 → used only for ≥12 px secondary labels, never for essential content; essential text uses `--foreground`. A light-only theme is the baseline; dark mode is not in scope (no requirement).

### 5.2 Status vocabulary (REQ-004, REQ-N031)

Every status renders as **icon + text + colour**, never colour alone, e.g. `● ACTIVE`, `◐ IN REVIEW · Stage 2/3`, `▲ DEGRADED`, `✕ REJECTED`. Hardware vs simulator always carries a text tag (`HARDWARE`, `SIMULATOR · CPU`) (REQ-030, N041). Null values render as **"Unavailable"** with a reason tooltip, never `0` (LLD §4.25). Demo records show a `DEMO DATA` pill; the demo tenant shows a persistent banner.

### 5.3 Application shell

```
┌────────────┬───────────────────────────────────────────────────────────────────────┐
│ ◆ QRP      │ Govern › Approvals › QRE-0042          [⌘K Search…]  [Tenant ▾] 🔔3 (AV)│
│ Quantum    ├───────────────────────────────────────────────────────────────────────┤
│ Resource   │  DEMO DATA — records in this tenant are illustrative, not live telemetry│
│ Portal     ├───────────────────────────────────────────────────────────────────────┤
│            │  Page title                                   [Secondary] [Primary +] │
│ OVERVIEW   │  one-line description                                                 │
│ ▣ Dashboard│                                                                       │
│ RESOURCE … │   … page content (cards, tables, charts) on #F7F9FC                   │
│ ▤ Inventory│                                                                       │
│ GOVERNANCE │                                                                       │
│ ✓ Approvals│                                                                       │
│ OPERATIONS │                                                                       │
│ SYSTEM     │                                                                       │
│ «collapse  │                                                                       │
└────────────┴───────────────────────────────────────────────────────────────────────┘
```

* Sidebar: 264 px, collapses to a 72 px icon rail (state remembered per browser); section labels in 11 px caps; active item = primary-tinted pill with a 3 px left indicator; keyboard: `Tab` through items, `[` toggles collapse.
* Header: breadcrumb, command-palette search (`Ctrl/⌘ K`, searches assets, providers, workloads, tickets by ID or name), tenant selector (only lists the user's memberships; switching rotates the session — LLD switch_tenant), notification bell with unread count and slide-over panel, avatar menu (profile, session info, sign out).
* Below `lg` (1024 px) the sidebar becomes an off-canvas drawer.

### 5.4 Governance dashboard layout

```
Row 1  KPI cards (4 per row, 2 rows): Registered resources · Active providers · Pending approvals (mine)
       · Active reservations · Quota limit (per unit) · Quota consumed (per unit, % bar) · Available
       resources (HW | SIM split) · Open inventory exceptions
Row 2  [Resource distribution by type — donut]  [By provider — horizontal bar]  [Hardware vs simulator — donut]
Row 3  [Monthly utilisation — line, HW and SIM as separate series]  [Approval trends — stacked bar by outcome]
Row 4  [Quota consumption trend — area per unit]                    [Provider connection status — list w/ badges]
Row 5  Tables: Recent approval requests · Pending actions for me · Upcoming reservations (7 days)
Row 6  Inventory exceptions · Recent audit activity
```

Every KPI is computed server-side by `GET /governance/summary`; each card shows its source window and "as of" time. A card whose data is unavailable shows the unavailable state, not zero.

### 5.5 Page patterns

* **List pages** (inventory, providers, tickets, audit): title bar → filter bar (search, faceted filters as popover chips, reset) → data table (sortable headers, sticky header, row hover, row click opens a **slide-over** preview, `Enter` opens full page) → pagination (page size 25 default, max 200 — LLD PD-07). Empty state with an illustration-free icon, one sentence and the primary action.
* **Detail pages**: header card (name, native ID in mono, status badges, primary actions) → tabs (Overview · Capabilities · Procurement · Reservations · Topology · Audit).
* **Forms**: two-column grid on desktop, single column on mobile; React Hook Form + Zod mirroring server validation; server `field_errors` mapped onto fields; destructive actions require a confirmation dialog that names the object.
* **Approval detail**: left = request summary and stage tracker (horizontal stepper with stage order, role, assignee, timestamps); right = decision panel (Approve / Request changes / Reject with mandatory comment for the latter two) and the immutable decision history timeline.
* **Scheduling**: calendar with Day / Week / Month views, one lane per backend in Day/Week, TENTATIVE = hatched outline, CONFIRMED = solid fill, conflicts shown as a red outline with explanation.
* **Feedback**: toasts for outcomes (with correlation id on errors), skeletons for loading, inline error cards with retry.
* **Motion**: 150–200 ms ease-out for hover/slide-overs/page fade; honours `prefers-reduced-motion`.

---

## 6. Differences between the master prompt and the reference documents

| # | Master prompt says | Reference documents say | Implementation |
|---|---|---|---|
| X-1 | "JWT/session-based authentication" | Opaque server-side session cookie `qre_sid` (HttpOnly, Secure, SameSite=Lax) + CSRF synchroniser token; API tokens for automation (LLD §4.3, §11.3) | Server sessions, no JWT in the browser |
| X-2 | "UUID identifiers where specified" | 26-char ULIDs, `CHAR(26)` (HLD §7.2, LLD App. B) | ULIDs |
| X-3 | SQLAlchemy 2.0 | SQLAlchemy 2 async (PD-01) | `sqlalchemy>=2.0,<2.1` (async, asyncpg) |
| X-4 | Horizontal backend folders | Vertical service slices (LLD §6.1, §13.3) | LLD layout (§4 above) |
| X-5 | Six roles | Eight role codes | Mapping in §3 |
| X-6 | "Assign quota to projects or tenants" | `quota_ledger` is per (project, unit, period) | Tenant view = aggregate of project ledgers |
| X-7 | Ticket priority, severity, assignment | `ticket` has category, queue, status — no priority/severity/assignee columns | See D-04 |
| X-8 | Notification read/unread | `notification` is a delivery record (channel, status) — no read flag | See D-05 |
| X-9 | Asset fields: description, capabilities, connectivity status, procurement reference, registration metadata | `asset` has name, category, manufacturer, model, serial, location, backend_id, `attributes` JSONB, status, source | description/capabilities/registration metadata → documented keys in `attributes`; classification → linked `backend.backend_class` or category `SIMULATOR`; connectivity → read-only from the provider's `connector.health_state`; procurement → `asset_procurement_link` (SVC-05) |
| X-10 | Asset deletion | Audit catalogue has ASSET_RETIRED, no delete | "Deactivate" = status `RETIRED`; see D-06 |
| X-11 | "Asset Details" in sidebar | Detail page needs an asset id | See D-11 |
| X-12 | "Open Inventory Exceptions" KPI | governance_summary lists "exceptions" without a definition | See D-08 |

---

## 7. Dependencies and unresolved decisions

### 7.1 Technology dependencies (pinned in Phase 1)

Backend: Python 3.12+, FastAPI, Pydantic v2 + pydantic-settings, SQLAlchemy 2.0 (async), asyncpg, Alembic, uvicorn, python-ulid, structlog-style JSON logging (stdlib), argon2-cffi (Phase 3), openpyxl (Phase 4), jsonschema (Phase 4), reportlab or WeasyPrint for PDF (Phase 6, D-12). Tests: pytest, pytest-asyncio, httpx.
Frontend: Node 20/22 LTS, React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, Framer Motion (`motion`), React Router, TanStack Query, React Hook Form, Zod. Tests: Vitest + Testing Library, Playwright, axe-core.
Infrastructure: PostgreSQL 16 (Ubuntu 24.04 package) with `btree_gist`. No Valkey/Redis needed in the laboratory profile (HLD §9, LLD §2.6). No object store in lab: file-system adapter under `backend/var/` (LLD Appendix D `QRE_OBJECT_STORE=fs`).

### 7.2 Decisions needed (proposed default in **bold**; I proceed with the default unless told otherwise)

| ID | Decision | Options | Proposed default | Needed before |
|---|---|---|---|---|
| D-01 | SVC-05 Procurement & Entitlements (OI-01, pending approval) | keep disabled · enable in demo only · enable everywhere | **Build it fully; `QRE_FEATURE_SVC05_ENABLED=false` in `.env.example`, `true` in the demo profile**; pages show "Pending approval — not enabled" when off | Phase 5 |
| D-02 | Default approval policy (OQ-02) | 1, 2 or 3 stages | **2 stages: Stage 1 "Technical review" → PROJECT_OWNER (project, 48 h), Stage 2 "Quota & policy review" → QUOTA_APPROVER (tenant, 72 h), escalation to PLATFORM_ADMIN** (matches SRS Appendix B) | Phase 5 |
| D-03 | Quota units and periods (OQ-03) | | **Units `shots`, `qpu_seconds`, `cpu_core_hours`, `gpu_hours`, `storage_gb_days`; monthly periods; no unit unlimited by default** | Phase 5 |
| D-04 | Ticket priority / severity / assignee (X-7) | (a) additive migration `ticket.priority`, `ticket.severity`, `ticket.assignee_id` marked *QRP extension, pending LLD amendment* · (b) severity only via category/queue, no assignee | **(a)**, recorded in DECISIONS.md and raised as an LLD change request | Phase 6 |
| D-05 | Notification read state + read endpoint (X-8) | (a) additive column `notification.read_at` for `channel='IN_APP'` + `GET /notifications`, `POST /notifications/{id}/read` · (b) no read state | **(a)**, flagged as extension | Phase 7 |
| D-06 | Asset hard delete (X-10) | none · admin-only for assets with no links/history | **No hard delete; "Deactivate" sets `RETIRED`** (preserves audit and procurement links) | Phase 4 |
| D-07 | Quota ledger maintenance endpoints | LLD has none listed | **Additive `GET/POST /quota-ledgers`, `PATCH /quota-ledgers/{id}` (QUOTA_APPROVER/PLATFORM_ADMIN)** — additive change allowed by LLD §8.1 versioning | Phase 5 |
| D-08 | Definition of "inventory exception" (X-12) | | **Count of: asset import jobs in `INVALID`; assets linked to a backend with `maintenance_lockout` or `dispatch_blocked`; assets whose provider is `SUSPENDED` or `RETIRED`** — each listed with its reason | Phase 6 |
| D-09 | Who may dispatch (OQ-05 / PD-39) and real connectors (OQ-04) | | **PROJECT_OWNER and PLATFORM_ADMIN; only a `demo-noop` connector is registered — it records a confirmed attempt for SIMULATOR backends and never contacts hardware; HARDWARE demo backends have submit *not verified* → 422 `OPERATION_NOT_VERIFIED`** | Phase 6 |
| D-10 | Frontend packaging | single app · LLD monorepo (4 SPAs + packages) | **Single Vite app with internal ui/api split** | Phase 1 ✔ |
| D-11 | "Asset Details" sidebar entry (X-11) | keep (opens last-viewed) · replace | **Replace with "Import Assets"; details open from inventory rows** | Phase 2 |
| D-12 | PDF library for reports | reportlab (pure Python) · WeasyPrint (needs system libs) | **reportlab** | Phase 6 |
| D-13 | MFA and federation (OI-05) | | **Local login only in lab; OIDC/SAML/TOTP deferred and shown as "not configured"** | Phase 3 |
| D-14 | Row-level security (PD-44, OQ-12) | | **Repository predicate always (approved); RLS migration shipped behind `QRE_RLS_ENABLED=false`** | Phase 3 |
| D-15 | Audit hash-chain head (LLD §4.18.1 references `audit_chain_heads`, which is not in Appendix B) | add table · advisory lock | **`pg_advisory_xact_lock(tenant)` + read latest row hash — no new table** | Phase 3 |
| D-16 | Demo data separation | flag column · separate tenant | **Separate tenant `DEMO` ("C-DAC Chennai — Demo") with `tenant.settings.demo_data=true`; demo `source_record_id`s prefixed `demo:`; seed script refuses to run when `QRE_ENV=production`** | Phase 3 |

Schedule note: LLD §12.4 / ROADMAP places M3 (core development) on 20-Nov-2026 and M5 (internal testing) on 04-Dec-2026.

---

## 8. Execution plan

| Phase | Content | Exit check |
|---|---|---|
| 1 Foundation | Repo, VS Code config, backend app factory, config, ULID, problem+json, correlation, async DB, health/readiness, Alembic baseline, frontend scaffold, tokens, API proxy, status page | `pytest` green; `/readyz` ready; status page shows API + DB OK |
| 2 UI foundation | shadcn components, shell (sidebar, header, breadcrumbs, search, notifications panel, tenant selector), StatusBadge, KPI card, DataTable, EmptyState, routing | Playwright: shell renders, keyboard navigation, axe clean |
| 3 Identity & governance shell | Identity tables, login/logout/sessions/CSRF, permissions.yaml, TenantContext, navigation API, audit writer, demo tenant + users, dashboard v1 | TC-IAM-* subset, cross-tenant 404 tests |
| 4 Resources | Providers, manifests, onboarding lifecycle, connectors (read), assets CRUD, bulk import, topology | TC-QRP-002, 003, 005, 006 |
| 5 Governance | Projects, workloads, policies, approval cycles/decisions, quota ledger/holds/evaluation, authorise, escalation worker, SVC-05 (flagged) | TC-QRP-004, 007, 010–013, 017 |
| 6 Operations | Reservations + calendar, dispatch attempts + demo connector, reconciliation, usage, SLA, reports, tickets | TC-QRP-008, 009, 014–016 |
| 7 Administration | Audit UI + chain verify, notifications, user management, settings | TC-AUD-001/002 |
| 8 Integration & quality | Rate limits, idempotency keys, full negative/security tests, Playwright suites | All suites green |
| 9 Finalisation | Polish, performance, docs, deployment profile (Nginx, systemd) | Acceptance checklist (master prompt §13) |
