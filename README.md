# Quantum Resource Portal (QRP)

**Separate application from Q-TeleScope.** This repository ships its own FastAPI backend (`backend/qre/`) and React frontend. Do not proxy workspace API calls to the TeleScope monorepo.

The **Govern** workspace of the Quantum Resource Ecosystem (QRE): resource inventory, provider onboarding, approvals and quotas, scheduling, metering, SLA, support and audit.

Built to the QRE SRS v1.0.0, HLD v1.1.0 and LLD v1.1.0 (C-DAC Chennai). See [`docs/00_REQUIREMENTS_AND_DESIGN.md`](docs/00_REQUIREMENTS_AND_DESIGN.md) for the requirement mapping and design, and [`docs/DECISIONS.md`](docs/DECISIONS.md) for open decisions.

| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, asyncpg), Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router |
| Tests | pytest, Vitest + Testing Library, Playwright |
| Reference UIs | **Local research only** — clone with `vendor-references/clone-all.sh` (not in git). Agents: [`docs/product/QRP_RECONSTRUCTION_SPIRIT.md`](docs/product/QRP_RECONSTRUCTION_SPIRIT.md) + [`FULL_STACK_STATUS.md`](docs/product/FULL_STACK_STATUS.md). |

## Notifications (operator inbox)

Session bell + panel sync queue/approvals from governance APIs. See [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md). Use `import { toast } from '@/lib/toast'` in workspace pages for operator feedback.

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

If migration **0010** failed halfway (`catalogue_provider` exists, `catalogue_backend` missing), `git pull` then:

```bash
cd backend && .venv/bin/alembic current
sudo -u postgres psql -d qre -c "DROP TABLE IF EXISTS catalogue_backend CASCADE; DROP TABLE IF EXISTS catalogue_provider CASCADE;"
# only if alembic_version is 0010 but tables were incomplete:
# sudo -u postgres psql -d qre -c "UPDATE alembic_version SET version_num='0009';"
cd .. && make migrate
```

# 3. Run (two terminals)
make dev-api      # http://127.0.0.1:8010  (API docs: /api/v1/docs)
make dev-web      # http://localhost:5176  (proxies /api → :8010)

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

Portal UI: http://127.0.0.1:5176/qrp · API: http://127.0.0.1:8010

**Ports:** QRP uses **8010** (API) and **5176** (dev UI) so Q-TeleScope can keep **8000** / **5173** / **4173**. Override via `QRP_API_PORT` / `QRP_API_TARGET` (see `scripts/lib/qrp-ports.sh`).  
**VM conflict:** If `verify-stack` fails on `:8010` but logs mention `:8000`, run `unset API_PORT UI_PORT`, `git pull`, then `bash scripts/vm-setup.sh` — stale `export API_PORT=8000` in `.bashrc` is auto-coerced to **8010** on recent scripts.
From the Q-TeleScope monorepo, use `scripts/vm-qrp-setup.sh` — it delegates to this repo's `scripts/vm-setup.sh`.
**Redis/Valkey** (port 6379) is used for CAPTCHA challenges and operational cache — `bash scripts/vm-setup.sh` starts it and sets `QRE_REDIS_URL` in `backend/.env`. **Signed-in sessions** remain in **PostgreSQL** (LLD §11.3), same pattern as Q-TeleScope’s split: durable session in DB, ephemeral data in Redis.

## VM

```bash
git clone git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git
cd QuantumResourcePortal
bash scripts/vm-pull-main.sh   # if you were on afk/* or diverged from main
bash scripts/vm-setup.sh       # QRE API :8010, Vite :5176, CAPTCHA + demo login in lab
```

Portal: http://\<host\>:5176/qrp
