# Quantum Resource Portal (QRP)

The **Govern** workspace of the Quantum Resource Ecosystem (QRE): resource inventory, provider onboarding, approvals and quotas, scheduling, metering, SLA, support and audit.

Built to the QRE SRS v1.0.0, HLD v1.1.0 and LLD v1.1.0 (C-DAC Chennai). See [`docs/00_REQUIREMENTS_AND_DESIGN.md`](docs/00_REQUIREMENTS_AND_DESIGN.md) for the requirement mapping and design, and [`docs/DECISIONS.md`](docs/DECISIONS.md) for open decisions.

| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, asyncpg), Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router |
| Tests | pytest, Vitest + Testing Library, Playwright |

## Status

**Phase 1 (foundation) is complete.** API health and readiness, problem+json errors, correlation ids, JSON logs, the Alembic baseline, the design tokens and the platform status page are in place.

## Quick start (Ubuntu 24.04)

Prerequisites: Python 3.12+, Node.js 20.19+ or 22.12+, PostgreSQL 16. The full walkthrough is [`docs/PHASE_1_GUIDE.md`](docs/PHASE_1_GUIDE.md).

```bash
# 1. Database (once)
sudo -u postgres psql -c "CREATE ROLE qre_app WITH LOGIN PASSWORD 'qre_dev_password';"
sudo -u postgres psql -c "CREATE DATABASE qre OWNER qre_app;"
sudo -u postgres psql -c "CREATE DATABASE qre_test OWNER qre_app;"

# 2. Dependencies, config and schema
make setup        # venv + pip install, npm ci, creates backend/.env
make migrate      # alembic upgrade head

# 3. Run (two terminals)
make dev-api      # http://127.0.0.1:8000  (API docs: /api/v1/docs)
make dev-web      # http://localhost:5173  (open this one)

# 4. Verify
make check        # lint + backend and frontend tests
```

## Repository layout

```
backend/   FastAPI app (qre/), Alembic migrations, tests
frontend/  Vite + React app (src/), Playwright e2e (e2e/)
docs/      Requirements mapping, design, phase guides, decision log
```

Run `make help` to see all commands.

## Desktop / Windows launchers

From this repository root:

```bash
# Linux — separate terminals for API + Vite (windows stay open)
./scripts/start-qrp.sh
```

```powershell
# Windows / PowerShell
.\scripts\Start-QRP.ps1
```

Portal UI: http://127.0.0.1:5176/qrp · API: http://127.0.0.1:8000

When developing inside the larger Quantum Monitoring monorepo, use
`Quantum_Monitoring-main/scripts/start-qrp.sh` so shared Postgres/Redis and the
integrated TeleScope API on `:8000` start with the portal.

## VM

```bash
git clone git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git
cd QuantumResourcePortal
# API is Q-TeleScope on :8000 (portal proxies /api)
export TELESCOPE_ROOT=/path/to/QTelescope
bash scripts/vm-setup.sh
```

Portal: http://\<host\>:5176/qrp
