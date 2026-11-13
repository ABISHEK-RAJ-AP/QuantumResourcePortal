# Quantum Resource Portal (QRP)

Standalone Govern workspace for the Quantum Resource Ecosystem (QRE): resource inventory, provider onboarding, approvals and quotas, scheduling, metering, SLA, support and audit.

Built to the QRE SRS v1.0.0, HLD v1.1.0 and LLD v1.1.0 (C-DAC Chennai). See [`docs/00_REQUIREMENTS_AND_DESIGN.md`](docs/00_REQUIREMENTS_AND_DESIGN.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, asyncpg), Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router |
| Tests | pytest, Vitest + Testing Library, Playwright |

## Status

**Phase 1 (foundation) is complete.** API health and readiness, problem+json errors, correlation ids, JSON logs, the Alembic baseline, the design tokens and the platform status page are in place.

## Quick start (one script)

Requires Python 3.11+, Node.js 20+, and PostgreSQL tools (`initdb` / `postgres` / `psql` — system package or miniforge). The setup script installs Python/Node project deps, starts a lab Postgres cluster under `.pgdata` when nothing is listening, migrates, and bootstraps a lab admin.

```bash
bash scripts/setup-qrp.sh   # deps + DB + migrate + admin
bash scripts/start-qrp.sh   # API + UI (idempotent; re-runs setup)
```

Portal: http://127.0.0.1:5176/qrp · API: http://127.0.0.1:8000/healthz (or the free port written to `logs/runtime.env`)

Lab admin (override with `QRE_BOOTSTRAP_USERNAME` / `QRE_BOOTSTRAP_PASSWORD`):

```
admin / Admin-Strong-Pw-2026
```

### Make targets (optional)

```bash
make setup        # venv + pip + npm only (no DB)
make migrate      # alembic upgrade head
make dev-api      # API with reload
make dev-web      # Vite on :5176 (proxies /api to QRP_API_TARGET or :8000)
make check        # lint + unit tests
```

## Repository layout

```
backend/   FastAPI app (qre/), Alembic migrations, tests
frontend/  Vite + React app (src/), Playwright e2e (e2e/)
docs/      Requirements mapping, design, phase guides, decision log
scripts/   setup-qrp.sh, start-qrp.sh, vm-setup.sh
```

## VM

```bash
git clone git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git
cd QuantumResourcePortal
bash scripts/vm-setup.sh
```

Portal: http://\<host\>:5176/qrp

Optional: `API_PORT=8000 UI_PORT=5176 bash scripts/vm-setup.sh`

## Windows

```powershell
.\scripts\Start-QRP.ps1
```
