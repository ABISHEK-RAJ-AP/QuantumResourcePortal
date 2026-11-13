# Quantum Resource Portal (QRP)

Standalone Govern workspace for the Quantum Resource Ecosystem (QRE): resource inventory, provider onboarding, approvals and quotas, scheduling, metering, SLA, support and audit.

Built to the QRE SRS v1.0.0, HLD v1.1.0 and LLD v1.1.0 (C-DAC Chennai). See [`docs/00_REQUIREMENTS_AND_DESIGN.md`](docs/00_REQUIREMENTS_AND_DESIGN.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

| Layer | Stack |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, asyncpg), Alembic |
| Database | PostgreSQL 16 (private lab cluster under `.pgdata`) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router |
| Tests | pytest, Vitest + Testing Library, Playwright |

## Default ports (dedicated)

| Service | Port |
|---|---|
| QRP API | **8088** (falls back 8001/8002/…) |
| QRP UI | **5176** |
| Lab Postgres | **5433** |

## VM / first run (copy-paste)

```bash
mkdir -p ~/apps && cd ~/apps
git clone git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git
cd QuantumResourcePortal
git checkout afk/2026-11-13
git pull --ff-only

# installs Postgres/Node/Python deps if missing, DB, migrate, admin, starts API+UI
bash scripts/vm-setup.sh
```

HTTPS clone:

```bash
git clone https://github.com/ABISHEK-RAJ-AP/QuantumResourcePortal.git
```

Open: `http://<vm-ip>:5176/qrp`  
Login: `admin` / `Admin-Strong-Pw-2026`

Already cloned — update and restart:

```bash
cd ~/apps/QuantumResourcePortal
git pull --ff-only
bash scripts/vm-setup.sh
```

## Local laptop

```bash
bash scripts/setup-qrp.sh   # deps + DB + migrate + admin
bash scripts/start-qrp.sh   # start API + UI
# or: make start
```

## What auto-install does

`scripts/lib/qrp-common.sh` will, when missing:

1. `python3` / `python3-venv` via apt  
2. Node via nvm (installs nvm if needed)  
3. PostgreSQL tools (`initdb`/`postgres`/`psql`) via apt, else conda/miniforge  
4. Private Postgres data dir `.pgdata` on **:5433**  
5. Backend venv + frontend `npm ci`  
6. Alembic migrate + lab admin bootstrap  

Override ports: `API_PORT=8088 UI_PORT=5176 QRP_PGPORT=5433 bash scripts/vm-setup.sh`

## Make targets

```bash
make setup-all   # same as scripts/setup-qrp.sh
make start       # setup + start
make stop        # kill PIDs in logs/*.pid
make check       # lint + unit tests
```

## Repository layout

```
backend/   FastAPI app (qre/), Alembic migrations, tests
frontend/  Vite + React app
docs/      Requirements, design, phase guides
scripts/   setup-qrp.sh, start-qrp.sh, vm-setup.sh
```
