# QRP RBAC — Delivery & Run Guide

This is the end-to-end summary of the Role-Based Access Control work (phases RBAC-1…10) and how to
run the whole system from scratch. Companion docs: `RBAC_IMPLEMENTATION_STATUS.md` (phase tracker +
change log), `RBAC_PERMISSION_MATRIX.md` (generated role×permission matrix), `DECISIONS.md`
(R-01…R-18), `RBAC_REQUIREMENT_TRACEABILITY.md`.

## 1. What was delivered

A deny-by-default, backend-enforced RBAC system on the QRP application (own backend + React SPA).
Q-TeleScope is a separate product; governance module APIs are implemented here per service slice, not proxied:

- **Identity & sessions** — Argon2id passwords, server-side opaque cookie sessions (`qre_sid`),
  in-memory CSRF synchroniser token, login lockout, bootstrap of the first PLATFORM_ADMIN.
- **Authorization** — DB-managed roles/permissions (`resource:action`), per-request grant
  derivation, scope-aware `Authorizer` (tenant/project/provider), cross-tenant reads return **404**
  (no existence leak). 70 permissions, 9 system roles, SRS Appendix B matrix enforced in code.
- **Admin APIs** — role lifecycle, permission edits, user management, membership grant/revoke, with
  anti-escalation (S-2) and last-administrator protection (S-7).
- **Audit** — append-only, hash-chained `audit_log`; read/export/verify API at `/rbac/audit`.
- **Frontend** — `AuthProvider` (loads `/me` before render), permission hooks, `PermissionGate` /
  `ProtectedRoute`, admin screens, permission-filtered nav. The browser never asserts a role.
## 2. Architecture

```
Browser (SPA) ──same origin──► QRP Vite :5176
                                    │ /api → QRP FastAPI :8000
                                    ▼
                            identity + RBAC admin + audit (shipped)
                            governance modules (inventory, approvals, … per phase)
```

- **One login, one origin, one CSRF scheme.** The SPA only ever talks to the QRP origin.
- **No client-chosen identity anywhere.** QRP derives identity from the cookie session; the gateway
  mints the TeleScope session server-side via the secret-gated `/auth/service-login`; TeleScope
  resolves identity only from that session. The retired `X-User-Role` header grants nothing.
- **Separation of duties** holds across both backends: PLATFORM_ADMIN / TeleScope `PlatformAdmin`
  cannot decide approvals; that authority sits on the approver role (QUOTA_APPROVER /
  `QuantumOpsAdmin`).

## 3. Running the full stack from scratch

Prerequisites: PostgreSQL 16, Python 3.12, Node 20+. Pick a shared gateway secret once, e.g.
`export GW_SECRET=$(openssl rand -hex 32)`.

### 3a. PostgreSQL + QRP database

```bash
# create the app role + databases (once)
createdb qre && createdb qre_test
# or use your existing cluster; the DSN is QRE_DATABASE_URL below
```

### 3b. QRP identity/RBAC backend (serves on :8080)

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export QRE_DATABASE_URL="postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre"
export QRE_ENV=lab
# RBAC-7: point the gateway at TeleScope and share the secret
export QRE_TELESCOPE_BASE_URL="http://127.0.0.1:8000"
export QRE_TELESCOPE_GATEWAY_SECRET="$GW_SECRET"

alembic upgrade head                     # creates identity, RBAC, audit tables + seeds the catalogue
QRE_BOOTSTRAP_PASSWORD='ChangeMe-Admin-123' \
  python -m qre bootstrap --tenant-code CDAC --tenant-name "C-DAC" --admin-username admin
uvicorn qre.gateway.app:create_app --factory --port 8080
```

### 3c. TeleScope module backend (serves on :8000)

```bash
cd QTelescope-main           # the Quantum_Monitoring monorepo
pip install -r backend/requirements.txt
export QRE_GATEWAY_SECRET="$GW_SECRET"   # MUST match the QRP backend's secret
# use a real database for the modules; SQLite is only for a subset of tests
USE_ALEMBIC=true PYTHONPATH=. uvicorn app.main:app --port 8000
```

> The gateway secret must be identical on both backends — it is the trust boundary for the
> service-login mint. If it is unset on the QRP side, module paths simply 404 (proxy disabled).

### 3d. Frontend SPA (dev server on :5176)

```bash
cd frontend
npm install
# IMPORTANT: point the dev proxy at the QRP GATEWAY (:8080), not TeleScope directly.
QRP_API_TARGET="http://127.0.0.1:8080" npm run dev
```

Open http://localhost:5176, sign in with the bootstrapped admin. Create more users/roles under
**Access Control**; module pages (inventory, approvals, …) are served through the gateway.

For production, build the SPA (`npm run build`) and serve it behind the QRP backend origin so
`/api/v1` is same-origin; set `QRE_ENV=production` (enables secure cookies, requires TLS DSN + CORS).

## 4. Running the tests

```bash
# QRP backend (needs PostgreSQL + qre_test):   99 passed, ruff clean
cd backend && . .venv/bin/activate && python -m pytest -q && ruff check .

# Frontend: typecheck, unit, build
cd frontend && npx tsc -b && npx vitest run && npx vite build   # 22 unit tests

# Frontend RBAC end-to-end (needs the full stack running + test users):
E2E_RUN_RBAC=1 E2E_ADMIN_USER=admin E2E_ADMIN_PW='ChangeMe-Admin-123' \
  E2E_RESEARCHER_USER=researcher E2E_RESEARCHER_PW='...' npx playwright test rbac-authorization

# TeleScope backend:   160 passed / 13 pre-existing SQLite-dialect & missing-fixture failures
cd QTelescope-main && python -m pytest tests -q
```

The 13 TeleScope failures pre-date this work (they need the Postgres schema that SQLite can't host,
and one missing fixture file); they are unrelated to RBAC. Run TeleScope's suite against PostgreSQL
to clear the dialect-specific ones.

## 5. Security posture (threat model S-1…S-12)

| # | Threat | Mitigation | Test |
|---|---|---|---|
| S-1 | Client-chosen role | Identity only from the session; `X-User-Role` ignored on both backends | `tests/security` S-1; e2e; TeleScope `test_rbac` |
| S-2 | Privilege escalation via grant | Anti-escalation policy; only PLATFORM_ADMIN grants privileged/tenant roles | `test_rbac_admin` |
| S-3 | Permission modification | Catalogue read-only; system roles immutable (trigger + service) | `test_rbac_admin` |
| S-4 | IDOR / cross-tenant | Tenant predicate; out-of-scope ids → 404 | `tests/security` S-4 |
| S-5 | Inactive user/role | Per-request check; deactivation revokes sessions | `test_rbac_auth` |
| S-6 | Role deletion while assigned | 409 / FK restrict | `test_rbac_admin` |
| S-7 | Last-admin lockout | Advisory lock + active-admin count | `test_rbac_admin` |
| S-8 | Self-approval | Submitter ≠ decider; PLATFORM_ADMIN cannot decide (SoD) | `test_rbac_policies`; TeleScope `test_governance_s9` |
| S-9 | Stale permissions | Per-request derivation; membership/authz versions | `test_rbac_auth` |
| S-10 | Mass assignment | `extra='forbid'`; server owns `tenant_id`/`is_system`/… | `tests/security` S-10 |
| S-11 | Client-side bypass | Every route guarded; start-up guard fails on any unguarded route | `tests/security` S-11; e2e |
| S-12 | Audit tampering | Append-only trigger + hash chain + no UPDATE/DELETE grant; `/rbac/audit/verify` | `tests/security` S-12 |

## 6. Notes & limitations

- **Two-backend topology.** Module endpoints live in TeleScope; the QRP gateway is the single door.
  If you consolidate onto one backend later, the role map in `qre/gateway/telescope_proxy.py` and the
  service-login endpoint are the seams to retire.
- **TeleScope role model.** TeleScope keeps its own role names; the QRP→TeleScope role map
  (`telescope_proxy.py`) translates. SoD is enforced on both sides.
- **Playwright** requires a live full stack and seeded users, so the RBAC scenario self-skips unless
  `E2E_RUN_RBAC=1`.
