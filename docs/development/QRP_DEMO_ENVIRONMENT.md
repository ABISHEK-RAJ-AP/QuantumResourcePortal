# QRP demo environment

Load the portal with **interconnected demonstration data** stored in PostgreSQL. The UI reads the same APIs as production; charts and KPIs are derived from seeded rows.

## Safety

| Rule | Detail |
| --- | --- |
| Profile | Seed refuses when `QRE_ENV=production` |
| Explicit action | Run `make seed-demo` or `POST /api/v1/admin/seed-demo` (PLATFORM_ADMIN, lab only) |
| Idempotency | Re-run is a no-op when `demo_seed_version` matches; use `--force` to rebuild |
| Reset | `python -m qre seed-demo --tenant-code CDAC --reset-only` removes `[DEMO]`-labelled rows only |
| Credentials | Lab demo users share password `quantum2026` — never reuse in production |

## Prerequisites

1. PostgreSQL running; `make migrate` applied through head.
2. Tenant bootstrapped, e.g. `python -m qre bootstrap --tenant-code CDAC --admin-username admin` with `QRE_BOOTSTRAP_PASSWORD`.
3. `QRE_ENV=lab` in `backend/.env`.

## Seed command

```bash
cd ~/QuantumResourcePortal
make demo-data   # ensures QRP Postgres (:5434), migrate, force seed CDAC
# or stepwise:
make migrate
QRE_ENV=lab make seed-demo                    # default tenant CDAC
# or
cd backend && QRE_ENV=lab .venv/bin/python -m qre seed-demo --tenant-code CDAC --force
```

After seeding, start stack:

```bash
make dev-api    # :8010
make dev-web    # :5176
```

## Demo accounts

| Username | Role (illustrative) | Password |
| --- | --- | --- |
| `admin` (bootstrap) | PLATFORM_ADMIN | `quantum2026` |
| `demo_researcher` | RESEARCHER on demo projects | `quantum2026` |
| `demo_pi` | PROJECT_OWNER on demo projects | `quantum2026` |
| `demo_operator` | OPERATOR (tenant) | `quantum2026` |
| `demo_auditor` | AUDITOR (tenant) | `quantum2026` |

All demo entities are prefixed `[DEMO]` or `DEMO-PRJ-*` / `demo-*` ids.

## UI: Load demo

Signed-in **PLATFORM_ADMIN** can use **Quick actions → Load demo**, which calls `POST /api/v1/admin/seed-demo`. If that route is blocked, the dock falls back to a thin legacy API chain.

## Scenarios (navigate in UI)

1. **Successful execution** — `DEMO-PRJ-0001` → approved workload → dispatch/job `demo-job-0001`
2. **Approval pending** — workloads in `submitted_for_review` / `in_review`
3. **Quota pressure** — tenant `daily_shots_cap` raised; ledger from approved workloads
4. **Reservation conflict** — overlapping `[DEMO]` holds on same `resource_ref` (inspect Reservations)
5. **Provider failure** — jobs/dispatch rows in `dispatch_failed` / `FAILED`
6. **Usage / reconciliation** — meter rollups + dispatch `dispatch_confirmed` rows
7. **Maintenance** — `demo-rigetti-aspen` in `MAINTENANCE`; related alerts
8. **Audit trail** — Governance audit after seed (project/workload/dispatch events)

## Simulation vs real telemetry

- **Real:** Provider connectors (when implemented) must show last refresh timestamp.
- **Demo:** Queue snapshots and provider metadata are **labelled demonstration** in catalogue `integration` JSON — never imply live IBM/IonQ connectivity.

**Demo simulation** (lab): `POST /api/v1/admin/demo-simulation/start` as PLATFORM_ADMIN, or **Start simulation** on the shell banner. The API background loop ticks every ~45s and updates `catalogue_backend.queue_snapshot`, `provider_job` status, and `[DEMO]` alerts in PostgreSQL. Audit actions are prefixed `DEMO_SIM_*`. Shell shows **DEMO SIMULATION** while active.

## Verify population

```bash
# after login as admin
curl -b cookies.txt -H "X-CSRF-Token: …" http://127.0.0.1:8010/api/v1/projects | jq '.items | length'
curl http://127.0.0.1:8010/api/v1/operations/centre | jq
```

Backend validation: `python -m qre seed-demo` prints counts; integrators can import `qre.seed.validate.validate_demo_seed`.

## VM verification (Postgres + integration + e2e)

```bash
make setup && make migrate
QRE_ENV=lab make seed-demo
cd backend && QRE_ENV=lab .venv/bin/python -m pytest tests/integration/ -q
make dev-vm   # or separate terminals: make dev-api && make dev-web
cd frontend && npm run test:e2e:smoke
npx playwright test e2e/module-detail.spec.ts
```

Login: `admin` or any `demo_*` user with password `quantum2026` (no CAPTCHA in lab unless you set `QRE_CAPTCHA_ENABLED=true`). Backend topology on demo hardware backends fills on seed (`demo-%` backends without nodes).

## Disable demo in shared environments

- Do not mount `qre.seed.api` (requires `QRE_ENV=lab`).
- Omit seed Makefile target from automation.
- Remove demo users with admin UI if accidentally created on a shared tenant.