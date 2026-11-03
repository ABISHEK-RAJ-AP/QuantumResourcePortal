# Phase 1 — Project Foundation (step-by-step, VS Code on Ubuntu)

**Goal:** a running FastAPI backend connected to PostgreSQL through Alembic migrations, a React + Tailwind frontend that talks to it through the Vite proxy, and green automated tests.

**Assumes:** Ubuntu 24.04, nothing created yet. Every command is run in a terminal (VS Code: **Terminal → New Terminal**, shortcut ``Ctrl+` ``).

> **Two ways to follow this guide**
> * **Type it yourself (recommended for learning):** run the commands in order and create each file with the contents shown. All code here is copied automatically from the verified repository, so it is complete and identical.
> * **Use the zip:** extract `quantum-resource-portal-phase1.zip`, then start at step 4 (venv) and skip the "create file" parts. Run `npm ci` (not `npm create`) in step 7.

Expected results were captured on a clean machine: 27 backend tests, 8 frontend unit tests and 2 Playwright tests pass.

---

## Step 1 — Check installed tools

```bash
python3 --version      # need 3.12 or newer   (Ubuntu 24.04 ships 3.12.3)
node --version         # need v20.19+ or v22.12+ (required by Vite 8)
npm --version          # 10.x or newer
psql --version         # PostgreSQL client 16.x
git --version
code --version         # VS Code CLI
```

**Install anything missing:**

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git curl build-essential
sudo apt install -y postgresql postgresql-contrib            # PostgreSQL 16 server + client
# Node.js 22 LTS (Ubuntu's own nodejs package is too old for Vite 8):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

*Why:* `python3-venv` is needed to create isolated environments; `postgresql-contrib` provides the `btree_gist` extension the reservation table needs later (LLD §4.8).

| Problem | Fix |
|---|---|
| `python3 --version` shows 3.10/3.11 | `sudo apt install python3.12 python3.12-venv`, then use `python3.12` wherever this guide says `python3` |
| `node` is v18 or older | Run the NodeSource lines above; `hash -r` then check again |
| `code: command not found` | In VS Code: Ctrl+Shift+P → "Shell Command: Install 'code' command in PATH" (or install VS Code from code.visualstudio.com) |

## Step 2 — Create the project directory and Git repository

```bash
mkdir -p ~/projects/quantum-resource-portal
cd ~/projects/quantum-resource-portal
git init -b main
mkdir -p backend frontend docs .vscode
```

Create these root files:

**`.gitignore`** — keeps the virtual environment, `node_modules`, build output and your real `.env` (passwords) out of Git.
{{file:.gitignore}}

**`.editorconfig`** — same indentation and line endings in every editor.
{{file:.editorconfig}}

**`Makefile`** — short names for the commands you will run every day (`make dev-api`, `make test` …). Note: Makefile recipe lines must start with a **Tab**, not spaces; VS Code respects this because of `.editorconfig`.
{{file:Makefile}}

**`README.md`**
{{file:README.md}}

## Step 3 — Open the project in VS Code

```bash
code .
```

Create the VS Code workspace settings:

**`.vscode/extensions.json`** — VS Code will offer to install these (Python, Ruff, Tailwind IntelliSense, oxc, Playwright, Vitest, SQLTools for PostgreSQL). Accept the prompt "Do you want to install the recommended extensions?".
{{file:.vscode/extensions.json}}

**`.vscode/settings.json`** — points VS Code at the backend virtual environment, enables pytest discovery and formats Python with Ruff on save.
{{file:.vscode/settings.json}}

**`.vscode/launch.json`** — lets you press **F5** to run the API under the debugger with breakpoints.
{{file:.vscode/launch.json}}

## Step 4 — Create the Python virtual environment

```bash
cd ~/projects/quantum-resource-portal/backend
python3 -m venv .venv
source .venv/bin/activate          # prompt now starts with (.venv)
python -m pip install --upgrade pip
```

*Why:* the venv keeps the project's exact library versions separate from the system Python. Activate it in every new terminal before running backend commands (`source backend/.venv/bin/activate`). In VS Code: Ctrl+Shift+P → **Python: Select Interpreter** → choose `./backend/.venv/bin/python`.

| Problem | Fix |
|---|---|
| `ensurepip is not available` | `sudo apt install python3-venv` (or `python3.12-venv`), delete `.venv`, retry |
| `pip install` says *externally-managed-environment* | The venv is not active — run `source .venv/bin/activate` |

## Step 5 — Install backend dependencies

Create the two requirements files (exact versions verified for this guide):

**`backend/requirements.txt`**
{{file:backend/requirements.txt}}

**`backend/requirements-dev.txt`**
{{file:backend/requirements-dev.txt}}

```bash
pip install -r requirements-dev.txt
pip list | grep -Ei 'fastapi|sqlalchemy|alembic|asyncpg|pydantic'
```

**Expected output (versions):** `alembic 1.20.1`, `asyncpg 0.32.0`, `fastapi 0.162.0`, `pydantic 2.14.2`, `pydantic-settings 2.16.2`, `SQLAlchemy 2.0.55`.

**`backend/pyproject.toml`** — project metadata plus pytest and Ruff settings.
{{file:backend/pyproject.toml}}

| Problem | Fix |
|---|---|
| `asyncpg` fails to build | `sudo apt install build-essential python3-dev` (normally a prebuilt wheel is used) |
| SSL / proxy errors | Set `HTTPS_PROXY` for your institute network, or `pip install --proxy http://host:port …` |

## Step 6 — Create the FastAPI application

Create the folders:

```bash
cd ~/projects/quantum-resource-portal/backend
mkdir -p qre/core qre/gateway/middleware qre/connectors qre/workers \
         qre/services/{svc02_identity,svc03_registry,svc04_inventory,svc05_procurement,svc06_approvals,svc07_scheduling,svc08_dispatch,svc14_metering,svc15_support,svc17_audit} \
         migrations/versions tests/unit tests/integration seeds
```

The layout follows LLD §6.1/§13.3: `core/` is the shared kernel, `gateway/` is SVC-01, and each SVC gets its own package (filled from Phase 3 on).

### 6.1 Package marker files

Each `__init__.py` makes a folder an importable Python package; the docstring states which LLD section it implements. Create them with these exact contents:

{{inits}}

Also create empty files `tests/__init__.py`, `tests/unit/__init__.py`, `tests/integration/__init__.py`:

```bash
touch tests/__init__.py tests/unit/__init__.py tests/integration/__init__.py
```

### 6.2 Configuration — `backend/qre/core/config.py`

Reads every `QRE_*` variable (LLD Appendix D) into a typed `Settings` object. Invalid values stop start-up with a clear message (LLD §13.9). The `production` profile refuses to start without an explicit MFA setting, a TLS database URL and a CORS list. `masked()` prints the configuration without the password.
{{file:backend/qre/core/config.py}}

### 6.3 Identifiers — `backend/qre/core/ids.py`

Every primary key in the LLD is a 26-character ULID (sortable by creation time). `new_ulid()` also guarantees increasing order inside the same millisecond.
{{file:backend/qre/core/ids.py}}

### 6.4 Errors — `backend/qre/core/errors.py`

The full Appendix C catalogue (48 codes). Code raises e.g. `QreError(code="QUOTA_INSUFFICIENT")`; the HTTP status and safe message come from the catalogue, so every screen sees the same codes.
{{file:backend/qre/core/errors.py}}

### 6.5 Logging — `backend/qre/core/logging.py`

One JSON object per log line with the correlation id, and masking of keys such as `password` or `token` (LLD §10.6, §10.8). Set `QRE_LOG_FORMAT=text` for a human-friendly format while developing.
{{file:backend/qre/core/logging.py}}

### 6.6 Database — `backend/qre/core/db.py`

Creates the async SQLAlchemy engine (asyncpg driver) with a 5 s statement timeout and UTC time zone, the `Base` class for future models (constraint naming as in LLD Appendix B), and the readiness checks: *database reachable within 2 s* and *migration head in the database = head in the code* (LLD §13.6).
{{file:backend/qre/core/db.py}}

### 6.7 Correlation middleware — `backend/qre/gateway/middleware/correlation.py`

Gives every request an `X-Correlation-ID` (keeps a valid one sent by the client), returns it in the response, writes an access-log line and converts any unexpected crash into a safe 500 response that still carries the id, so a user can quote it to support.
{{file:backend/qre/gateway/middleware/correlation.py}}

### 6.8 Error responses — `backend/qre/gateway/problem.py`

Turns exceptions into the LLD §10.2 `application/problem+json` body. Input validation errors become `400 VALIDATION_FAILED` with `field_errors` (FastAPI's default would be 422 with a different shape).
{{file:backend/qre/gateway/problem.py}}

### 6.9 Health probes — `backend/qre/gateway/health.py`

`/healthz` (is the process alive?) and `/readyz` (can it serve traffic: configuration, database, migrations). Readiness returns 503 with the same JSON when a check fails.
{{file:backend/qre/gateway/health.py}}

### 6.10 Application factory — `backend/qre/gateway/app.py`

Builds the FastAPI app in the LLD §13.7 order: configuration → logging → database pool → routers. API docs are served at `/api/v1/docs`, the OpenAPI document at `/api/v1/openapi.json`. CORS is added only if origins are configured (same-origin needs none).
{{file:backend/qre/gateway/app.py}}

### 6.11 Entry points

**`backend/qre/main.py`** — what uvicorn loads.
{{file:backend/qre/main.py}}

**`backend/qre/__main__.py`** — `python -m qre config-check` validates and prints the configuration.
{{file:backend/qre/__main__.py}}

### 6.12 Environment file

**`backend/.env.example`** — committed template. Copy it to `.env` (ignored by Git):
{{file:backend/.env.example}}

```bash
cp .env.example .env
python -m qre config-check
```

**Expected output:** the configuration as JSON with `"database_url": "postgresql+asyncpg://qre_app:***@localhost:5432/qre"`, then `Configuration is valid.`

**`backend/seeds/README.md`**
{{file:backend/seeds/README.md}}

## Step 7 — Create the frontend and install its dependencies

```bash
cd ~/projects/quantum-resource-portal
rmdir frontend                                     # create-vite wants to create it
npm create vite@latest frontend -- --template react-ts --no-interactive
cd frontend
npm install
```

Install the libraries for all phases now, so later phases do not need new installs:

```bash
npm install react-router @tanstack/react-query lucide-react recharts motion \
  react-hook-form zod @hookform/resolvers clsx tailwind-merge class-variance-authority \
  tw-animate-css @fontsource-variable/inter @fontsource-variable/jetbrains-mono

npm install -D tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Remove the template's demo files (we replace them):

```bash
rm -f src/App.tsx src/App.css src/index.css README.md public/icons.svg
rm -rf src/assets
mkdir -p src/{api,app,components/brand,components/status,lib,pages/system,styles,test} e2e
```

Replace **`frontend/package.json`** with this version (adds the `test`, `typecheck` and `test:e2e` scripts and the Node version requirement). If `npm install` gave you newer versions, keeping yours is fine; these are the verified ones.
{{file:frontend/package.json}}

```bash
npm install          # re-sync after replacing package.json
```

| Problem | Fix |
|---|---|
| `npm create vite` asks questions | Your create-vite is older; answer *React* → *TypeScript*, or run `npm create vite@9 …` |
| `EBADENGINE` / Vite refuses to start | Node is too old — see step 1 |
| `EACCES` errors | Never use `sudo npm`; fix ownership with `sudo chown -R $USER ~/.npm` |

## Step 8 — Configure React, Tailwind CSS and shadcn/ui

### 8.1 Build configuration

**`frontend/vite.config.ts`** — React + Tailwind plugins, the `@/` import alias, and the **dev proxy**: the browser calls `http://localhost:5173/api/...` and Vite forwards it to FastAPI on port 8000. This keeps everything same-origin, which the session cookie design requires (LLD PD-34).
{{file:frontend/vite.config.ts}}

**`frontend/vitest.config.ts`** — unit tests run in a simulated browser (jsdom).
{{file:frontend/vitest.config.ts}}

**`frontend/tsconfig.app.json`** — strict TypeScript and the `@/*` path alias.
{{file:frontend/tsconfig.app.json}}

**`frontend/tsconfig.node.json`** — TypeScript settings for the config files and Playwright tests.
{{file:frontend/tsconfig.node.json}}

### 8.2 shadcn/ui

shadcn/ui is not a package you import: its CLI copies component source files into `src/components/ui/`. It needs two things, which we create by hand so the result is predictable:

**`frontend/components.json`** — tells the CLI where components, utilities and the CSS file live.
{{file:frontend/components.json}}

**`frontend/src/lib/utils.ts`** — the `cn()` helper every shadcn component uses.
{{file:frontend/src/lib/utils.ts}}

Components are added in Phase 2 with e.g. `npx shadcn@latest add button card dialog`. **Do not run `npx shadcn init`**: it would overwrite the design tokens below.

### 8.3 Design tokens — `frontend/src/styles/index.css`

The colour palette, fonts, radius and shadows from the design concept (docs §5.1), wired into Tailwind v4 (`@theme inline`) so classes like `bg-surface`, `text-success-text` and `shadow-card` work. Important detail: in shadcn, `--accent` and `--secondary` are *subtle hover surfaces*, so they are tints of blue here, and the brand violet and cyan are separate tokens (`--brand-violet`, `--brand-cyan`). Status colours have a darker `*-text` variant so badge text meets WCAG AA contrast.
{{file:frontend/src/styles/index.css}}

### 8.4 Application code

**`frontend/index.html`**
{{file:frontend/index.html}}

**`frontend/public/favicon.svg`** — QRP logo mark.
{{file:frontend/public/favicon.svg}}

**`frontend/src/main.tsx`** — mounts React with the providers and router.
{{file:frontend/src/main.tsx}}

**`frontend/src/app/providers.tsx`** — TanStack Query client: caching, and no automatic retries for 4xx errors.
{{file:frontend/src/app/providers.tsx}}

**`frontend/src/app/router.tsx`** — routes (only the status page for now).
{{file:frontend/src/app/router.tsx}}

**`frontend/src/components/brand/LogoMark.tsx`**
{{file:frontend/src/components/brand/LogoMark.tsx}}

**`frontend/src/components/status/StatusBadge.tsx`** — the status badge used everywhere: icon + text + colour, never colour alone (REQ-004, REQ-N031).
{{file:frontend/src/components/status/StatusBadge.tsx}}

## Step 9 — Configure PostgreSQL

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager      # expect: active (exited)
pg_lsclusters                                    # expect: 16 main 5432 online
```

Create the application role and two databases (development and test):

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE qre_app WITH LOGIN PASSWORD 'qre_dev_password';
CREATE DATABASE qre      OWNER qre_app ENCODING 'UTF8';
CREATE DATABASE qre_test OWNER qre_app ENCODING 'UTF8';
SQL
```

**Expected output:** `CREATE ROLE`, `CREATE DATABASE`, `CREATE DATABASE`.

Test the login the application will use:

```bash
PGPASSWORD=qre_dev_password psql -h localhost -U qre_app -d qre -c "select current_user, version();"
```

**Expected output:** `qre_app | PostgreSQL 16.x …`

*Why two databases:* the test suite drops and recreates the schema on `qre_test`; your development data in `qre` is never touched. The test configuration enforces this (see `tests/conftest.py`).

*Lab simplification:* `qre_app` owns the databases. The LLD (§4.1.6) requires that in production the application role is **not** the table owner; Phase 9 adds a separate migration role.

Optional — browse the database inside VS Code: SQLTools sidebar → **Add New Connection** → PostgreSQL, host `localhost`, port `5432`, database `qre`, user `qre_app`.

| Problem | Fix |
|---|---|
| `password authentication failed for user "qre_app"` | Password differs from `.env`; reset: `sudo -u postgres psql -c "ALTER ROLE qre_app PASSWORD 'qre_dev_password';"` |
| `Peer authentication failed` | You omitted `-h localhost`; peer auth applies to Unix-socket logins |
| `role "qre_app" already exists` | Fine — it was created before; continue |
| `connection refused` on 5432 | `sudo systemctl start postgresql`; check `pg_lsclusters` |

## Step 10 — Database migrations

Alembic records each schema change as a numbered *revision* and applies them in order. Phase 1 creates the baseline: the `btree_gist` extension, the append-only trigger function used later by approval decisions and the audit log, and the `tenant` table — all copied verbatim from LLD Appendix B.

**`backend/alembic.ini`**
{{file:backend/alembic.ini}}

**`backend/migrations/env.py`** — runs migrations with the async driver and takes the database URL from `QRE_DATABASE_URL` (not from `alembic.ini`, so no password is stored there).
{{file:backend/migrations/env.py}}

**`backend/migrations/script.py.mako`** — template for new revision files.
{{file:backend/migrations/script.py.mako}}

**`backend/migrations/versions/20261102_0001_baseline.py`**
{{file:backend/migrations/versions/20261102_0001_baseline.py}}

Apply it:

```bash
cd ~/projects/quantum-resource-portal/backend
source .venv/bin/activate
alembic upgrade head
alembic current
```

**Expected output:**

```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, Baseline: extensions, append-only trigger function and the tenant table.
0001 (head)
```

Check in PostgreSQL:

```bash
PGPASSWORD=qre_dev_password psql -h localhost -U qre_app -d qre -c '\d tenant'
```

| Problem | Fix |
|---|---|
| `permission denied to create extension "btree_gist"` | Install `postgresql-contrib`; or run once as superuser: `sudo -u postgres psql -d qre -c 'CREATE EXTENSION btree_gist;'` (same for `qre_test`) |
| `ModuleNotFoundError: No module named 'qre'` | Run Alembic from inside `backend/` (the `prepend_sys_path = .` setting relies on it) |
| `QRE_DATABASE_URL must start with 'postgresql+asyncpg://'` | Fix the driver part of the URL in `.env` |

## Step 11 — Connect the frontend to the backend

**`frontend/src/api/client.ts`** — the only place that calls `fetch`. It sends same-origin cookies, never touches localStorage, and converts problem+json errors into an `ApiError` that screens can display (including the correlation id).
{{file:frontend/src/api/client.ts}}

**`frontend/src/api/system.ts`** — typed calls for `/healthz` and `/readyz`.
{{file:frontend/src/api/system.ts}}

**`frontend/src/pages/system/StatusPage.tsx`** — the platform status page. It shows the whole path browser → Vite proxy → FastAPI → PostgreSQL → migrations, refreshing every 15 seconds, with a recovery hint when the API is down.
{{file:frontend/src/pages/system/StatusPage.tsx}}

## Step 12 — Demo data

Nothing to load in Phase 1: the demo tenant, users and records depend on the identity, registry and governance tables built in Phases 3–6. Phase 3 adds `backend/seeds/seed_demo.py` (decision D-16: a separate `DEMO` tenant, every record labelled DEMO DATA, refuses to run in production).

## Step 13 — Run the complete application

Use two terminals (VS Code: the **split terminal** button).

**Terminal 1 — backend**

```bash
cd ~/projects/quantum-resource-portal
make dev-api
```

Expected: `Uvicorn running on http://127.0.0.1:8000` and a JSON line `"msg": "api starting"`.

**Terminal 2 — frontend**

```bash
cd ~/projects/quantum-resource-portal
make dev-web
```

Expected: `VITE v8.x ready … Local: http://localhost:5173/`.

Open **http://localhost:5173** (Ctrl+click in the terminal). You are redirected to `/system/status`, which shows **ALIVE**, **READY**, **LAB PROFILE** and three **OK** checks (configuration valid; database reachable; migrations at head 0001).

Try these too:

| URL | You should see |
|---|---|
| http://localhost:5173/api/v1/docs | Swagger UI "Quantum Resource Portal API" |
| http://localhost:8000/readyz | `{"status":"ready", … "migrations":{"ok":true,"detail":"at head 0001"}}` |
| http://localhost:8000/api/v1/nothing-here | problem+json `RESOURCE_NOT_FOUND` with a `correlation_id` |

**Failure drills (worth doing once):** stop PostgreSQL (`sudo systemctl stop postgresql`) → within 15 s the page shows **NOT READY** with the database check **FAILING**; start it again and it recovers. Stop the backend (Ctrl+C in terminal 1) → the page shows **UNREACHABLE** with the hint to run `make dev-api`.

| Problem | Fix |
|---|---|
| Port 8000 / 5173 already in use | `lsof -i :8000` then `kill <PID>`, or run uvicorn with `--port 8001` and start Vite with `QRP_API_TARGET=http://127.0.0.1:8001 npm run dev` |
| Status page shows **NOT READY**, migrations failing | Run `make migrate` |
| Page is unstyled | Check `src/main.tsx` imports `@/styles/index.css` and `@tailwindcss/vite` is in `vite.config.ts` |
| `/api/...` returns the Vite page instead of JSON | The proxy only covers `/api`, `/healthz`, `/readyz`; restart Vite after editing `vite.config.ts` |

## Step 14 — Test everything built so far

### 14.1 Backend tests

**`backend/tests/conftest.py`** — points the app at `qre_test` *before* anything is imported, migrates it from scratch once per run, and provides an HTTP client against the fully started app.
{{file:backend/tests/conftest.py}}

**`backend/tests/unit/test_ids.py`**
{{file:backend/tests/unit/test_ids.py}}

**`backend/tests/unit/test_config.py`**
{{file:backend/tests/unit/test_config.py}}

**`backend/tests/unit/test_errors.py`**
{{file:backend/tests/unit/test_errors.py}}

**`backend/tests/integration/test_gateway.py`** — correlation ids and every error path (404, domain error, validation, malformed JSON, unexpected crash with no leaked internals).
{{file:backend/tests/integration/test_gateway.py}}

**`backend/tests/integration/test_database.py`** — readiness at head, with pending migrations, with an unreachable database, and the baseline schema objects.
{{file:backend/tests/integration/test_database.py}}

```bash
cd ~/projects/quantum-resource-portal
make test-backend
```

**Expected output:** `27 passed`. You can also run them from VS Code's **Testing** panel (flask icon).

### 14.2 Frontend tests

**`frontend/src/test/setup.ts`**
{{file:frontend/src/test/setup.ts}}

**`frontend/src/api/client.test.ts`**
{{file:frontend/src/api/client.test.ts}}

**`frontend/src/pages/system/StatusPage.test.tsx`**
{{file:frontend/src/pages/system/StatusPage.test.tsx}}

```bash
make test-frontend
```

**Expected output:** `Test Files 2 passed (2)` · `Tests 8 passed (8)`.

### 14.3 End-to-end tests (real browser)

**`frontend/playwright.config.ts`** — runs each test at desktop and phone size.
{{file:frontend/playwright.config.ts}}

**`frontend/e2e/status.spec.ts`**
{{file:frontend/e2e/status.spec.ts}}

```bash
cd ~/projects/quantum-resource-portal/frontend
npx playwright install --with-deps chromium     # once: downloads the browser
cd .. && make dev-api                            # in another terminal, if not running
make test-e2e
```

**Expected output:** `2 passed` (desktop and mobile).

### 14.4 Lint and type checks, then commit

```bash
make lint          # expect: "All checks passed!", "N files already formatted"; oxlint and tsc print nothing when clean
git add .
git commit -m "Phase 1: project foundation (FastAPI, PostgreSQL, Alembic, React, Tailwind)"
```

Check `git status` shows no `.env`, `.venv` or `node_modules` — `.gitignore` excludes them.

---

## Phase 1 exit checklist

- [ ] `python -m qre config-check` → *Configuration is valid.*
- [ ] `alembic current` → `0001 (head)`
- [ ] Status page shows READY with three OK checks
- [ ] `make test-backend` → 27 passed; `make test-frontend` → 8 passed; `make test-e2e` → 2 passed
- [ ] `make lint` clean; first commit made

**Next — Phase 2 (UI foundation):** shadcn components, the application shell (collapsible sidebar with the role-filtered sections, header with breadcrumbs, search, tenant selector, notifications and profile menu), KPI cards, data table, empty/error/loading states, routing for every QRP page, and accessibility tests.
