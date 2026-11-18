# QRP current state audit

**Sources:** `docs/product/FULL_STACK_STATUS.md`, `WORKSPACE_UI_CATALOG.md`, `backend/qre/gateway/app.py`, `frontend/src/app/router.tsx`  
**Date:** 2026-11-18

## Runtime topology

| Process | URL | Role |
| --- | --- | --- |
| Vite | `http://localhost:5176` | React SPA; proxies `/api`, `/healthz`, `/readyz` → `QRP_API_TARGET` (default `:8010`) |
| FastAPI | `http://127.0.0.1:8010` | `/api/v1/*`, probes unversioned |
| PostgreSQL 16 | `DATABASE_URL` | Sessions, RBAC, audit |
| Redis (optional) | `QRE_REDIS_URL` | CAPTCHA + cache — **not** sessions |

## Frontend routes (authenticated shell)

Defined in `frontend/src/app/router.tsx`. Grouped by nav intent:

| Group | Routes |
| --- | --- |
| **Work** | `/qrp`, `/qrp/centre`, `/qrp/approvals`, `/qrp/approvals/history`, `/qrp/approvals/:workloadId`, `/qrp/projects`, `/qrp/projects/:projectId` |
| **Resources** | `/qrp/inventory`, `/qrp/inventory/new`, `/qrp/inventory/import`, `/qrp/inventory/:assetId`, `/qrp/providers`, `/qrp/providers/onboarding`, `/qrp/providers/:providerId`, `/qrp/pools/:poolId`, `/qrp/connectors`, redirects for pools/backends |
| **Compute** | `/qrp/jobs`, `/qrp/jobs/:jobId`, `/qrp/dispatch`, `/qrp/reconciliation`, `/qrp/reservations`, `/qrp/scheduling`, `/qrp/support`, `/qrp/incidents`, `/qrp/incidents/:incidentId`, `/qrp/support/:alertId` |
| **Govern** | `/qrp/policies`, `/qrp/quotas`, `/qrp/metering`, `/qrp/audit`, `/qrp/procurement`, `/qrp/entitlements`, `/qrp/sla` |
| **Admin / system** | `/qrp/settings`, `/qrp/profile`, `/qrp/admin/users`, `/qrp/admin/users/:userId`, `/qrp/admin/roles`, `/qrp/admin/roles/new`, `/qrp/admin/roles/:roleId`, `/qrp/admin/permissions`, `/qrp/notifications`, `/system/status` |
| **Public** | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/mfa` |

Nav chrome: `frontend/src/components/layout/chrome.tsx` (`NAV` groups). Workflow rail: contextual only (approvals, assets, incidents, wizards) per `WORKSPACE_UI_CATALOG.md`.

## Backend routers — implemented vs lab vs missing

From `backend/qre/gateway/app.py`:

| Router | Status |
| --- | --- |
| `health` (`/healthz`, `/readyz`) | **Production** |
| `identity` (`/api/v1/auth/*`, `/me`, navigation, permissions) | **Production** |
| `ping` (RBAC demos) | **Production** |
| `admin` (`/api/v1/admin/*`) | **Production** |
| `authz` (`/api/v1/authz/check`) | **Production** |
| `audit` (`/api/v1/rbac/audit`) | **Production** (identity/RBAC audit — not governance domain events) |
| `workspace_lab` | **Lab only** when `settings.is_lab` (`QRE_ENV=lab`) |

### Lab GET stubs (`workspace_lab/api.py`)

Mounted only in lab: `/governance/summary`, `/operations/centre`, `/quotas/ledger`, `/queues`, `/dispatch-attempts`, `/alerts/summary`, `/governance/activity`, `/approvals` (partial shapes).

### UI calls with **no production router** (from FULL_STACK_STATUS)

Includes: `/projects`, `/workload-submissions`, `/approvals/*` (full contract), `/inventory/*`, `/providers`, `/reservations`, `/scheduling`, `/jobs`, `/backends`, `/queues`, `/virtual-pools`, `/connectors`, `/dispatch-icd`, `/incidents`, `/alerts/*`, `/meter-rollups`, `/governance/audit-events`, `/evidence/snapshots`, `/quotas/evaluate`, etc.

**Split:** Admin Access UI → `/api/v1/admin/*` ✅. Audit & Evidence page → `/governance/audit-events` ❌ (use `/rbac/audit` for RBAC stream only).

## Auth constraints (must preserve)

| Requirement | Implementation |
| --- | --- |
| Session | HttpOnly cookie `qre_sid`, PostgreSQL `session` table |
| CSRF | `X-CSRF-Token`, memory-only client token from `GET /api/v1/auth/csrf` |
| Same-origin | Browser → Vite proxy → API |
| RBAC | `require_permission`, `ProtectedRoute`, `GET /me/navigation` |
| No localStorage sessions | Per LLD / `FULL_STACK_STATUS` |
| Startup guard | `assert_api_router_guarded` — unguarded routes denied |

**Do not** add second auth or weaken guards during reconstruction.

## Database

Alembic `0001`–`0005`: tenant, identity, RBAC shells (`project`, `provider` DDL **without** HTTP APIs), hash-chained `audit_log`.

Governance domain tables (workloads, reservations, assets, …) per LLD — **largely not migrated**; UI anticipates future services.

## Module readiness classification (snapshot)

| Module | UI | API | DB | Class |
| --- | --- | --- | --- | --- |
| Login / session / CSRF | Yes | Yes | Yes | **1 — Implemented** |
| Admin users/roles | Yes | Yes | Yes | **1** |
| RBAC audit export | Partial UI | Yes | Yes | **1** |
| Home / Operations KPIs | Yes | Lab stub only | No | **3 — Lab** |
| Projects / Approvals / Inventory / Jobs / … | Yes | Missing / lab | Partial shells | **4–5 — Frontend / planned** |

## Implication for reference-driven rebuild

Frontend pages are **contract-complete** against SRS/LLD; reference study must inform **both** UX and FastAPI service slices. Phase 5 must not ship “beautiful 404s” — pair each module with Phase 6 API minimum viable router or explicit empty state citing missing backend.