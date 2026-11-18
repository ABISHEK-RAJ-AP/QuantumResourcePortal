# QRP target architecture (reference-informed)

**Date:** 2026-11-18  
**Constraint:** Preserve existing auth, CSRF, RBAC, PostgreSQL sessions. **No** vendor merge into `frontend/src` or `backend/qre`.

## High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│  React 19 + Vite + TanStack Query + React Router (/qrp/*)   │
│  App shell · Page · shared components · wizards             │
└───────────────────────────┬─────────────────────────────────┘
                            │ same-origin cookie + CSRF
┌───────────────────────────▼─────────────────────────────────┐
│  FastAPI gateway (backend/qre/gateway/app.py)               │
│  /api/v1 — identity · admin · authz · audit (existing)      │
│  + modular routers per domain (new, Phase 6)                │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   PostgreSQL 16        Redis (optional)   Provider adapters
   Alembic migrations   CAPTCHA/cache      (qBraid, simulators, HPC)
```

## Service boundaries (target modules)

| Service slice | Responsibility | Reference inspiration |
| --- | --- | --- |
| **Identity** (shipped) | Login, session, CSRF, MFA hooks | QRP native |
| **AuthZ / Admin** (shipped) | Roles, permissions, memberships | CompanyOS scoping ideas — QRP RBAC stays canonical |
| **Project registry** | Projects, members, lifecycle | ColdFront `Project` model patterns |
| **Workload & approval** | Submissions, review queue, decisions | ColdFront allocation requests |
| **Quota** | Ledger, evaluate, enforce | ColdFront + MCAD quota semantics |
| **Inventory** | Assets, pools, backends | Horizon-style catalogue (reimplemented) |
| **Provider adapter** | Connectors, health, capabilities | qBraid provider abstraction |
| **Reservation** | Holds, leases, conflicts | Blazar + LibreBooking UX |
| **Scheduling** | Placement, FTQMP-style constraints | FTQMP-Scheduler algorithms (adapter) |
| **Dispatch** | Attempts, routing, retry | MCAD + qBraid |
| **Jobs** | Execution status, results metadata | OnDemand job monitor |
| **Metering / reconcile** | Usage rollups, variance | XDMoD ETL concepts |
| **Incidents / alerts** | Ops tickets | Argo failure semantics |
| **Governance audit** | Domain events (separate from RBAC audit) | XDMoD + append-only store |
| **Evidence** | Snapshots, provenance | Argo workflow outputs |

## Implementation priorities (1–5)

| Priority | Scope | Deliverables |
| --- | --- | --- |
| **1 — Foundation** | Preserve working systems | Auth/RBAC/audit; design system + shell; shared components; OpenAPI/contracts; Alembic conventions |
| **2 — Core governance** | Projects → quotas | Project CRUD, members, workload submit, approvals, policies, quota evaluate |
| **3 — Quantum infrastructure** | Catalogue → scheduling | Inventory, providers, backends, pools, queues, reservations, scheduling |
| **4 — Execution & ops** | Run → reconcile | Jobs, dispatch, monitoring, reconciliation, incidents |
| **5 — Accountability** | Metering → admin | Metering, governance audit, evidence, reporting, settings hardening |

## Frontend architecture rules

- One cohesive **ops console** — extract patterns, not skins (ColdFront governance density + OnDemand execution clarity + Blazar/LibreBooking calendars + XDMoD analytics).
- **Reference Component Catalog** drives shared widgets; no per-page one-off tables.
- Explicit **loading / empty / error** tied to API truth (no fabricated KPIs).

## Backend architecture rules

- FastAPI routers per domain under `backend/qre/services/` with Pydantic `extra=forbid`.
- Every mutation: permission guard, validation, audit record, idempotency where needed.
- Provider logic behind **adapters** — no vendor SDK in route handlers.

## Data architecture

- ULIDs, tenant scope, `row_version` optimistic concurrency (existing LLD patterns).
- RBAC audit chain remains; add **governance `audit_event`** table when domain APIs ship.
- Lab mode: retain `workspace_lab` until production router parity; label demo in UI.

## Non-goals

- Replacing FastAPI with Django/Rails.
- Embedding AGPL/GPL vendor UIs.
- Multi-tenant SaaS marketing chrome (CompanyOS visual language is contrast, not target).