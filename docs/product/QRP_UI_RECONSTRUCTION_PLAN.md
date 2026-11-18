# QRP UI reconstruction plan (dependency order)

**Not a visual reskin.** Each row is a **module vertical slice**: reference-informed IA + real API + honest states.

**Prerequisites:** `QRP_RECONSTRUCTION_SPIRIT.md`, this file, `QRP_API_IMPLEMENTATION_MATRIX.md`, `WORKSPACE_UI_CATALOG.md`.

## Phase gates

| Phase | Output | Where |
| --- | --- | --- |
| **1 — Discovery** | Baseline assessment, vendor inventory, screen map | **Local** `docs/reference-analysis/` |
| **2 — Decisions** | Capability matrix, form catalogue, decision log | **Local** `docs/reference-analysis/` |
| **3 — Foundations** | Shell, tables, forms, QueryBody patterns | Code + `QRP_DESIGN_SYSTEM.md` |
| **4 — Workflows** | P0→P1 backend slices | Code + matrices in `docs/product/` |
| **5 — Screens** | Per-route acceptance | Browser QA checklist below |
| **6 — QA** | pytest, Playwright, permission tests | CI / `make verify-stack` |

Do **not** start Phase 5 page polish on routes whose APIs are `missing` unless the change is empty/error honesty.

---

## Module queue

### P0 — Governance foundation

| # | Route focus | Reference IA | Backend slice | UI work |
| --- | --- | --- | --- | --- |
| 1 | `/qrp/projects`, wizard | ColdFront project registry | svc03 ✓ | Wizard fields ↔ API; create list refresh |
| 2 | `/qrp/projects/:id` Members tab | ColdFront membership | **members API ✓** | Members tab uses live API; revoke UI later |
| 3 | `/qrp/approvals`, detail | ColdFront + CompanyOS | svc06 ✓ | Quota panel waits on evaluate |
| 4 | Workload wizard | OnDemand composer → quantum | svc06 ✓ | Metadata schema; no fake dispatch |
| 5 | `/qrp/quotas` | XDMoD + ColdFront allocation | **quota ledger ✓** | Honest empty until approvals complete |

### P1 — Capacity & catalogue

| # | Route focus | Reference IA | Backend slice | UI work |
| --- | --- | --- | --- | --- |
| 6 | `/qrp/reservations`, scheduling | Blazar + LibreBooking | svc07 ✓ | Calendar + conflict panel ✓ |
| 7 | `/qrp/inventory` | Horizon inventory | **svc04 assets** | Lifecycle on detail |
| 8 | `/qrp/providers`, onboarding | qBraid + CompanyOS | **providers/connectors** | No secrets in UI |
| 9 | Backends tab / detail | qBraid capabilities | **backends API** | Topology/calibration when data exists |
| 10 | `/qrp/pools/*` | Pool membership | **virtual-pools** | |

### P1 — Execution

| # | Route focus | Reference IA | Backend slice | UI work |
| --- | --- | --- | --- | --- |
| 11 | `/qrp/jobs`, `/:id` | OnDemand + Argo | **jobs + attempts** | Dual IDs; timeline |
| 12 | `/qrp/dispatch` | CodeFlare | **dispatch-icd** | Operator reconcile actions |

### P2 — Accountability

| # | Route focus | Reference IA | Backend slice | UI work |
| --- | --- | --- | --- | --- |
| 13 | `/qrp/metering` | XDMoD | meter-rollups | Chart = real series or empty |
| 14 | `/qrp/reconciliation` | XDMoD accounting | reconcile API | Discrepancy copy |
| 15 | `/qrp/audit` (governance) | CompanyOS | audit-events | Keep RBAC audit separate |
| 16 | `/qrp`, `/qrp/centre` | Horizon + XDMoD | SQL KPIs | Drill-down links only when data real |

---

## Per-screen checklist (Phase 5)

For each route when its API is `shipped`:

1. User + objective documented in `WORKSPACE_UI_CATALOG.md`
2. `Page → qre() → service → DB` traced
3. Filters hit backend query params
4. Mutations invalidate correct query keys
5. Permission-gated actions match backend 403
6. Empty / loading / error states verified
7. No decorative workflow rail on hub
8. Playwright smoke updated if route is critical

---

## Page IA reminders (do not homogenise)

| Page | Workspace metaphor |
| --- | --- |
| Approvals | Decision queue |
| Backends | Capability catalogue |
| Jobs | Execution monitor |
| Reservations | Capacity calendar + leases |
| Quotas | Accounting ledger |
| Centre | Operator control room |
| Projects | Research resource workspace |

---

## Current sprint recommendation

**Next implementation slice (after reservations):**

1. `GET/POST/DELETE /projects/{project_id}/members` + project detail tab
2. Real `GET /quotas/ledger` (minimal project rows) replacing lab stub in production
3. ~~`svc04` inventory assets~~ → **next:** providers/backends or jobs/dispatch

Reference study for each slice: local clones + evidence in `docs/reference-analysis/QRP_REFERENCE_DECISION_LOG.md` (local, optional).