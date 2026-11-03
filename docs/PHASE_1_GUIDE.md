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

```text
# Python
backend/.venv/
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
backend/var/
# Secrets / local config
backend/.env
*.env.local
# Node
frontend/node_modules/
frontend/dist/
frontend/test-results/
frontend/playwright-report/
frontend/coverage/
# Editors / OS
.DS_Store
*.swp
```


**`.editorconfig`** — same indentation and line endings in every editor.

```text
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
```


**`Makefile`** — short names for the commands you will run every day (`make dev-api`, `make test` …). Note: Makefile recipe lines must start with a **Tab**, not spaces; VS Code respects this because of `.editorconfig`.

```makefile
# Quantum Resource Portal — common development commands.
# Run `make help` to list them. All commands are run from the repository root.

SHELL := /bin/bash
VENV  := backend/.venv
PY    := $(VENV)/bin/python

.PHONY: help setup setup-backend setup-frontend migrate dev-api dev-web test test-backend test-frontend test-e2e lint check

help:  ## List available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-backend setup-frontend  ## Install backend and frontend dependencies

setup-backend:  ## Create the Python venv and install backend dependencies
	test -d $(VENV) || python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r backend/requirements-dev.txt
	test -f backend/.env || cp backend/.env.example backend/.env

setup-frontend:  ## Install frontend dependencies from the lock file
	cd frontend && npm ci

migrate:  ## Apply database migrations to the development database
	cd backend && .venv/bin/alembic upgrade head

dev-api:  ## Run the FastAPI backend with auto-reload on :8000
	cd backend && .venv/bin/uvicorn qre.main:app --reload --host 127.0.0.1 --port 8000

dev-web:  ## Run the Vite dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

test: test-backend test-frontend  ## Run backend and frontend unit/integration tests

test-backend:  ## Backend tests (needs the qre_test database)
	cd backend && .venv/bin/python -m pytest

test-frontend:  ## Frontend unit tests
	cd frontend && npm test

test-e2e:  ## Playwright end-to-end tests (backend must be running)
	cd frontend && npx playwright test

lint:  ## Lint and format-check backend and frontend
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run lint && npm run typecheck

check: lint test  ## Everything CI would run (except e2e)
```


**`README.md`**

````markdown
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
````


## Step 3 — Open the project in VS Code

```bash
code .
```

Create the VS Code workspace settings:

**`.vscode/extensions.json`** — VS Code will offer to install these (Python, Ruff, Tailwind IntelliSense, oxc, Playwright, Vitest, SQLTools for PostgreSQL). Accept the prompt "Do you want to install the recommended extensions?".

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "bradlc.vscode-tailwindcss",
    "oxc.oxc-vscode",
    "ms-playwright.playwright",
    "vitest.explorer",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg",
    "editorconfig.editorconfig"
  ]
}
```


**`.vscode/settings.json`** — points VS Code at the backend virtual environment, enables pytest discovery and formats Python with Ruff on save.

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python",
  "python.testing.pytestEnabled": true,
  "python.testing.cwd": "${workspaceFolder}/backend",
  "python.testing.pytestArgs": ["tests"],
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": { "source.organizeImports": "explicit" }
  },
  "typescript.tsdk": "frontend/node_modules/typescript/lib",
  "tailwindCSS.experimental.configFile": "frontend/src/styles/index.css",
  "files.associations": { "*.css": "tailwindcss" },
  "editor.rulers": [100],
  "files.exclude": { "**/__pycache__": true, "**/.pytest_cache": true, "**/.ruff_cache": true }
}
```


**`.vscode/launch.json`** — lets you press **F5** to run the API under the debugger with breakpoints.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: FastAPI (uvicorn)",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["qre.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend",
      "envFile": "${workspaceFolder}/backend/.env",
      "jinja": true
    },
    {
      "name": "Backend: pytest (current file)",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["${file}", "-q"],
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```


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

```text
# QRP backend — runtime dependencies (pinned; verified on Python 3.12 and 3.13)
# Install with:  pip install -r requirements.txt
fastapi==0.162.0
uvicorn[standard]==0.54.0
pydantic==2.14.2
pydantic-settings==2.16.2
SQLAlchemy[asyncio]==2.0.55
asyncpg==0.32.0
alembic==1.20.1
python-ulid==4.1.0
```


**`backend/requirements-dev.txt`**

```text
# QRP backend — test and lint dependencies
# Install with:  pip install -r requirements-dev.txt   (includes runtime deps)
-r requirements.txt
pytest==9.2.0
pytest-asyncio==1.4.1.post1
httpx==0.28.1
ruff==0.17.3
```


```bash
pip install -r requirements-dev.txt
pip list | grep -Ei 'fastapi|sqlalchemy|alembic|asyncpg|pydantic'
```

**Expected output (versions):** `alembic 1.20.1`, `asyncpg 0.32.0`, `fastapi 0.162.0`, `pydantic 2.14.2`, `pydantic-settings 2.16.2`, `SQLAlchemy 2.0.55`.

**`backend/pyproject.toml`** — project metadata plus pytest and Ruff settings.

```toml
[project]
name = "qre-qrp-backend"
version = "0.1.0"
description = "Quantum Resource Portal (QRP) backend — QRE governance workspace API"
requires-python = ">=3.12"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
asyncio_default_test_loop_scope = "session"
markers = [
    "db: test needs a reachable PostgreSQL database (QRE_TEST_DATABASE_URL)",
]
filterwarnings = ["error::DeprecationWarning:qre.*"]

[tool.ruff]
line-length = 100
target-version = "py312"
extend-exclude = ["migrations/versions"]

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "S", "ASYNC"]
ignore = ["S101"]  # assert is fine in tests

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S105", "S106"]
"qre/core/errors.py" = ["E501"]  # catalogue kept one-code-per-line like LLD Appendix C
```


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

**`backend/qre/__init__.py`**

```python
"""Quantum Resource Portal (QRP) backend — QRE governance workspace."""
```

**`backend/qre/connectors/__init__.py`**

```python
"""Connector adapter framework (LLD §4.22). Phase 4/6: manifest model and demo-noop adapter."""
```

**`backend/qre/core/__init__.py`**

```python
"""Shared kernel (LLD §4.1): configuration, ids, errors, database, logging."""
```

**`backend/qre/gateway/__init__.py`**

```python
"""SVC-01 API gateway and edge routing (LLD §4.2)."""
```

**`backend/qre/gateway/middleware/__init__.py`**

```python
"""ASGI middleware (correlation; auth, rate limit and size guards arrive in later phases)."""
```

**`backend/qre/services/__init__.py`**

```python
"""Domain services, one package per SVC (LLD §6.1). Other modules import only service.py."""
```

**`backend/qre/services/svc02_identity/__init__.py`**

```python
"""SVC-02 Identity and User Management (LLD §4.3). Phase 3."""
```

**`backend/qre/services/svc03_registry/__init__.py`**

```python
"""SVC-03 Provider and Resource Registry (LLD §4.4). Phase 4."""
```

**`backend/qre/services/svc04_inventory/__init__.py`**

```python
"""SVC-04 Inventory and Asset Management (LLD §4.5). Phase 4."""
```

**`backend/qre/services/svc05_procurement/__init__.py`**

```python
"""SVC-05 Procurement and Entitlements (LLD §4.6). Phase 5.

Pending Approval (OI-01): served only when QRE_FEATURE_SVC05_ENABLED=true, otherwise 501.
"""
```

**`backend/qre/services/svc06_approvals/__init__.py`**

```python
"""SVC-06 Approvals and Quota Management (LLD §4.7). Phase 5."""
```

**`backend/qre/services/svc07_scheduling/__init__.py`**

```python
"""SVC-07 Scheduling and Reservations (LLD §4.8). Phase 6."""
```

**`backend/qre/services/svc08_dispatch/__init__.py`**

```python
"""SVC-08 Workload and Execution Dispatch, QRP-facing parts (LLD §4.9). Phase 6."""
```

**`backend/qre/services/svc14_metering/__init__.py`**

```python
"""SVC-14 Metering and SLA (LLD §4.15). Phase 6."""
```

**`backend/qre/services/svc15_support/__init__.py`**

```python
"""SVC-15 Support and Incident Management (LLD §4.16). Phase 6."""
```

**`backend/qre/services/svc17_audit/__init__.py`**

```python
"""SVC-17 Notification and Audit Log (LLD §4.18). Phase 3 (writer) / Phase 7 (UI)."""
```

**`backend/qre/workers/__init__.py`**

```python
"""Worker runtime on the PostgreSQL job_queue (LLD §4.23). Phase 5."""
```


Also create empty files `tests/__init__.py`, `tests/unit/__init__.py`, `tests/integration/__init__.py`:

```bash
touch tests/__init__.py tests/unit/__init__.py tests/integration/__init__.py
```

### 6.2 Configuration — `backend/qre/core/config.py`

Reads every `QRE_*` variable (LLD Appendix D) into a typed `Settings` object. Invalid values stop start-up with a clear message (LLD §13.9). The `production` profile refuses to start without an explicit MFA setting, a TLS database URL and a CORS list. `masked()` prints the configuration without the password.

```python
"""Typed application configuration (LLD §13.4, §13.9, Appendix D).

All settings come from environment variables prefixed ``QRE_`` or from ``backend/.env``.
Invalid configuration aborts start-up with a precise message (no partial start).
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
"""Absolute path of the ``backend/`` directory (contains ``.env`` and ``alembic.ini``)."""

APP_VERSION = "0.1.0"


class Profile(StrEnum):
    LAB = "lab"
    PRODUCTION = "production"


class LogFormat(StrEnum):
    JSON = "json"
    TEXT = "text"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QRE_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Profile = Profile.LAB
    database_url: SecretStr = Field(
        description="SQLAlchemy async DSN, e.g. postgresql+asyncpg://user:pw@host:5432/qre"
    )
    public_base_url: str = "http://localhost:5173"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    log_level: str = "INFO"
    log_format: LogFormat = LogFormat.JSON

    session_idle_min: int = Field(default=30, ge=5, le=24 * 60)
    session_absolute_h: int = Field(default=12, ge=1, le=7 * 24)
    mfa_required: bool = False

    page_size_default: int = Field(default=25, ge=1, le=200)
    page_size_max: int = Field(default=200, ge=1, le=1000)

    max_body_mb: int = Field(default=10, ge=1, le=100)
    max_upload_mb: int = Field(default=50, ge=1, le=500)

    readiness_db_timeout_ms: int = Field(default=2000, ge=100, le=30000)
    api_statement_timeout_ms: int = Field(default=5000, ge=100, le=60000)  # PD-35

    feature_svc05_enabled: bool = False  # Procurement & Entitlements — Pending Approval (OI-01)
    rls_enabled: bool = False  # PostgreSQL RLS second layer — Pending Approval (PD-44)

    error_type_base: str = "https://qre.cdac.in/errors/"  # placeholder base URI (LLD §10.2)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("database_url")
    @classmethod
    def _async_driver(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+asyncpg://"):
            raise ValueError("QRE_DATABASE_URL must start with 'postgresql+asyncpg://'")
        return value

    @field_validator("log_level")
    @classmethod
    def _level(cls, value: str) -> str:
        level = value.upper()
        if level not in {"DEBUG", "INFO", "WARNING", "ERROR"}:
            raise ValueError("QRE_LOG_LEVEL must be DEBUG, INFO, WARNING or ERROR")
        return level

    @model_validator(mode="after")
    def _cross_field_rules(self) -> Settings:
        if self.page_size_default > self.page_size_max:
            raise ValueError("QRE_PAGE_SIZE_DEFAULT must not exceed QRE_PAGE_SIZE_MAX")
        if self.env is Profile.PRODUCTION:
            # LLD §13.9: production requires explicit MFA setting, TLS DB URL and CORS list.
            problems = []
            if "mfa_required" not in self.model_fields_set:
                problems.append("QRE_MFA_REQUIRED must be set explicitly")
            if "ssl=" not in self.database_url.get_secret_value():
                problems.append("QRE_DATABASE_URL must enable TLS (e.g. ?ssl=verify-full)")
            if not self.cors_origins:
                problems.append("QRE_CORS_ORIGINS must list the allowed origins")
            if problems:
                raise ValueError("production profile: " + "; ".join(problems))
        return self

    @property
    def is_lab(self) -> bool:
        return self.env is Profile.LAB

    def masked(self) -> dict[str, Any]:
        """Effective configuration with secrets masked (used by `qre config-check`)."""
        data = self.model_dump(mode="json")
        dsn = self.database_url.get_secret_value()
        if "@" in dsn and ":" in dsn.split("@", 1)[0]:
            scheme_user, rest = dsn.split("@", 1)
            scheme_user = scheme_user.rsplit(":", 1)[0] + ":***"
            dsn = f"{scheme_user}@{rest}"
        data["database_url"] = dsn
        return data


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings (validated once, cached)."""
    return Settings()  # type: ignore[call-arg]  # values come from the environment
```


### 6.3 Identifiers — `backend/qre/core/ids.py`

Every primary key in the LLD is a 26-character ULID (sortable by creation time). `new_ulid()` also guarantees increasing order inside the same millisecond.

```python
"""Identifier helpers (HLD §7.2, LLD §4.1.3–4.1.4, REQ-D001).

Every primary key is a 26-character Crockford base32 ULID stored as CHAR(26).
"""

from __future__ import annotations

import re
import threading

from ulid import ULID

ULID_PATTERN = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")
"""Regex from LLD §4.1.4 (Crockford alphabet, upper case, no I L O U)."""

_lock = threading.Lock()
_last: ULID | None = None


def new_ulid() -> str:
    """Return a new ULID string, monotonic within the process.

    Two ULIDs generated in the same millisecond are ordered by incrementing the random part,
    so sorting by id preserves creation order (LLD §4.1.3, property test TC-DAT-*).
    """
    global _last
    with _lock:
        candidate = ULID()
        if _last is not None and candidate.milliseconds == _last.milliseconds:
            candidate = ULID.from_int(int(_last) + 1)
        elif _last is not None and int(candidate) <= int(_last):
            candidate = ULID.from_int(int(_last) + 1)
        _last = candidate
        return str(candidate)


def is_ulid(value: str) -> bool:
    """True when *value* is a syntactically valid ULID string."""
    return bool(ULID_PATTERN.fullmatch(value))
```


### 6.4 Errors — `backend/qre/core/errors.py`

The full Appendix C catalogue (48 codes). Code raises e.g. `QreError(code="QUOTA_INSUFFICIENT")`; the HTTP status and safe message come from the catalogue, so every screen sees the same codes.

```python
"""QRE error hierarchy and catalogue (LLD §10.1–10.3, Appendix C).

Domain code raises ``QreError`` (or a subclass). The gateway turns it into an
``application/problem+json`` response. Messages are client-safe: they never reveal other
tenants' data, account existence, stack traces, SQL or credentials.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ErrorSpec:
    status: int
    category: str
    title: str
    retryable: bool = False


# Appendix C — complete catalogue (48 codes). Keep in sync with the LLD.
CATALOGUE: dict[str, ErrorSpec] = {
    "VALIDATION_FAILED": ErrorSpec(
        400, "Validation", "One or more fields are invalid. See field_errors."
    ),
    "MALFORMED_REQUEST": ErrorSpec(400, "Validation", "Request body could not be parsed as JSON."),
    "UNSUPPORTED_MEDIA_TYPE": ErrorSpec(
        415, "Validation", "Content type is not supported for this endpoint."
    ),
    "FORMAT_NOT_SUPPORTED": ErrorSpec(
        415, "Validation", "The file format is not enabled by deployment policy."
    ),
    "PAYLOAD_TOO_LARGE": ErrorSpec(413, "Edge", "Request body exceeds the permitted size."),
    "RATE_LIMITED": ErrorSpec(
        429, "Edge", "Too many requests. Retry after the indicated interval.", True
    ),
    "IDEMPOTENCY_KEY_REUSED": ErrorSpec(
        409, "Validation", "Idempotency-Key was already used with a different request body."
    ),
    "IDEMPOTENCY_IN_PROGRESS": ErrorSpec(
        409, "Validation", "A request with this Idempotency-Key is still being processed.", True
    ),
    "AUTH_REQUIRED": ErrorSpec(401, "Authentication", "Authentication is required."),
    "AUTH_INVALID_CREDENTIALS": ErrorSpec(
        401, "Authentication", "Sign-in failed. Check your credentials and try again."
    ),
    "AUTH_SESSION_EXPIRED": ErrorSpec(
        401, "Authentication", "Your session has expired. Please sign in again."
    ),
    "AUTH_MFA_REQUIRED": ErrorSpec(401, "Authentication", "Additional verification is required."),
    "AUTH_MFA_INVALID": ErrorSpec(401, "Authentication", "The verification code is not valid."),
    "AUTH_FEDERATION_REQUIRED": ErrorSpec(
        409, "Authentication", "This account signs in through the institutional identity provider."
    ),
    "AUTH_CSRF_FAILED": ErrorSpec(
        403, "Authentication", "Request verification failed. Reload the page and retry."
    ),
    "AUTH_FORBIDDEN": ErrorSpec(
        403, "Authorization", "You do not have permission to perform this action."
    ),
    "RESOURCE_NOT_FOUND": ErrorSpec(
        404, "Authorization / Lookup", "The requested resource was not found."
    ),
    "TENANT_CONTEXT_INVALID": ErrorSpec(
        403, "Authorization", "The active tenant is not available to this account."
    ),
    "TEMPLATE_NOT_PERMITTED": ErrorSpec(
        403, "Authorization", "Your role may only create projects from the assigned templates."
    ),
    "SOD_VIOLATION": ErrorSpec(
        403, "Authorization", "Submitters cannot approve their own workload."
    ),
    "INVALID_STATE_TRANSITION": ErrorSpec(
        409, "State", "The action is not allowed in the current state."
    ),
    "REVISION_CONFLICT": ErrorSpec(
        409, "State", "The resource was changed by someone else. Reload and merge."
    ),
    "DUPLICATE_NATIVE_ID": ErrorSpec(
        409, "State", "An asset with this native identifier already exists for this provider."
    ),
    "WORKLOAD_NOT_AUTHORIZED": ErrorSpec(
        409, "State", "Dispatch is not authorised for this workload."
    ),
    "DISPATCH_IN_PROGRESS": ErrorSpec(
        409, "State", "A dispatch attempt for this workload is already in progress."
    ),
    "DISPATCH_UNRESOLVED": ErrorSpec(
        409, "State", "The previous dispatch outcome is unresolved. Reconciliation is required."
    ),
    "MANUAL_RECONCILIATION_REQUIRED": ErrorSpec(
        409, "State", "Automatic retry is blocked; an operator must reconcile."
    ),
    "PROVIDER_SUSPENDED": ErrorSpec(
        409, "State", "The provider is suspended. New dispatch is blocked."
    ),
    "BACKEND_UNAVAILABLE": ErrorSpec(
        409, "State", "The backend is not operational or is under maintenance lockout."
    ),
    "QUOTA_INSUFFICIENT": ErrorSpec(409, "State", "Quota is insufficient for this request."),
    "RESERVATION_CONFLICT": ErrorSpec(
        409, "State", "The requested window overlaps an existing reservation."
    ),
    "SPEC_IMMUTABLE": ErrorSpec(
        409,
        "State",
        "This specification version is referenced by an approved run and cannot be changed.",
    ),
    "GATE_APPROVAL_REQUIRED": ErrorSpec(
        409, "State", "Human approval is required before this step."
    ),
    "PREFLIGHT_FAILED": ErrorSpec(409, "State", "Preflight reported blocking violations."),
    "MANIFEST_INVALID": ErrorSpec(
        422, "Domain validation", "The capability manifest failed schema validation."
    ),
    "METRIC_NOT_SUPPORTED": ErrorSpec(
        422, "Domain validation", "The metric is not declared by the connector manifest."
    ),
    "OPERATION_NOT_SUPPORTED": ErrorSpec(
        422, "Domain validation", "The connector does not support this operation."
    ),
    "OPERATION_NOT_VERIFIED": ErrorSpec(
        422, "Domain validation", "The connector operation has not passed conformance tests."
    ),
    "IMPORT_VALIDATION_FAILED": ErrorSpec(
        422, "Domain validation", "The import file contains invalid rows. No rows were saved."
    ),
    "COMPILATION_FAILED": ErrorSpec(
        422, "Domain validation", "Source contains errors. See diagnostics."
    ),
    "SIM_CLASS_NOT_REGISTERED": ErrorSpec(
        422, "Domain validation", "No simulator of the requested class is registered."
    ),
    "POLICY_INVALID": ErrorSpec(
        422, "Domain validation", "Approval or quota policy definition is invalid."
    ),
    "EVIDENCE_SERVICE_DISABLED": ErrorSpec(
        501, "Feature", "Evidence and provenance is not enabled for this deployment."
    ),
    "FEATURE_NOT_ENABLED": ErrorSpec(
        501, "Feature", "This capability is not enabled for this deployment."
    ),
    "CONNECTOR_FAILED": ErrorSpec(502, "Dependency", "The external provider returned an error."),
    "CONNECTOR_TIMEOUT": ErrorSpec(
        504, "Dependency", "The external provider did not respond in time."
    ),
    "SERVICE_UNAVAILABLE": ErrorSpec(
        503, "Infrastructure", "The service is temporarily unavailable.", True
    ),
    "INTERNAL_ERROR": ErrorSpec(
        500,
        "Infrastructure",
        "An unexpected error occurred. Quote the correlation id when reporting.",
    ),
}


@dataclass(frozen=True, slots=True)
class FieldError:
    field: str
    code: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"field": self.field, "code": self.code, "message": self.message}


class QreError(Exception):
    """Base class for every client-visible error.

    ``code`` must be a key of :data:`CATALOGUE`; HTTP status and title come from it.
    ``detail`` is an optional client-safe sentence specific to this occurrence.
    """

    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        detail: str | None = None,
        *,
        code: str | None = None,
        field_errors: list[FieldError] | None = None,
        headers: dict[str, str] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        if code is not None:
            self.code = code
        if self.code not in CATALOGUE:
            raise ValueError(f"Unknown QRE error code: {self.code}")
        self.detail = detail
        self.field_errors = field_errors or []
        self.headers = headers or {}
        self.extra = extra or {}
        super().__init__(detail or self.spec.title)

    @property
    def spec(self) -> ErrorSpec:
        return CATALOGUE[self.code]

    @property
    def status(self) -> int:
        return self.spec.status


class ValidationFailed(QreError):
    code = "VALIDATION_FAILED"


class AuthRequired(QreError):
    code = "AUTH_REQUIRED"


class Forbidden(QreError):
    code = "AUTH_FORBIDDEN"


class ResourceNotFound(QreError):
    """Raised for absent rows *and* rows in another tenant (never 403; REQ-009, PD-09)."""

    code = "RESOURCE_NOT_FOUND"


class InvalidStateTransition(QreError):
    code = "INVALID_STATE_TRANSITION"


class RevisionConflict(QreError):
    code = "REVISION_CONFLICT"


class FeatureNotEnabled(QreError):
    code = "FEATURE_NOT_ENABLED"


class ServiceUnavailable(QreError):
    code = "SERVICE_UNAVAILABLE"
```


### 6.5 Logging — `backend/qre/core/logging.py`

One JSON object per log line with the correlation id, and masking of keys such as `password` or `token` (LLD §10.6, §10.8). Set `QRE_LOG_FORMAT=text` for a human-friendly format while developing.

```python
"""Structured logging (LLD §10.6, §10.8).

One JSON object per line with timestamp, level, logger, message, correlation id and any
``extra`` fields. Keys that look like secrets are masked before they are written.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

correlation_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "correlation_id", default=None
)

_SECRET_KEY = re.compile(r"(password|secret|token|authorization|cookie|private_key|api_key)", re.I)
_STANDARD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "taskName",
}


def mask(value: Any) -> Any:
    """Recursively replace values whose key looks secret with '***' (LLD §4.18.1 rule 2)."""
    if isinstance(value, dict):
        return {
            k: ("***" if isinstance(k, str) and _SECRET_KEY.search(k) else mask(v))
            for k, v in value.items()
        }
    if isinstance(value, list | tuple):
        return [mask(v) for v in value]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        corr = correlation_id_var.get()
        if corr:
            payload["corr_id"] = corr
        extras = {k: v for k, v in record.__dict__.items() if k not in _STANDARD_ATTRS}
        if extras:
            payload.update(mask(extras))
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        corr = correlation_id_var.get() or "-"
        when = self.formatTime(record, "%H:%M:%S")
        base = f"{when} {record.levelname:<7} [{corr}] {record.name}: {record.getMessage()}"
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    """Configure the root logger once; uvicorn's loggers propagate into it."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if fmt == "json" else TextFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # Our access log replaces uvicorn's (it includes correlation id and duration).
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True
```


### 6.6 Database — `backend/qre/core/db.py`

Creates the async SQLAlchemy engine (asyncpg driver) with a 5 s statement timeout and UTC time zone, the `Base` class for future models (constraint naming as in LLD Appendix B), and the readiness checks: *database reachable within 2 s* and *migration head in the database = head in the code* (LLD §13.6).

```python
"""Database access: async engine, sessions and readiness checks (LLD §4.1, §7.9, §13.6).

* One async engine per process (asyncpg driver).
* ``Base`` is the declarative base for every ORM model; table and constraint names follow
  the LLD Appendix B conventions (pk_<table>, uq_<table>_<n>, fk_<table>_<n>, ck_<table>_<n>).
* Tenant scoping (repository predicate) and the UnitOfWork arrive in Phase 3 and build on
  :func:`set_tenant_guc`.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from qre.core.config import BACKEND_DIR, Settings

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base for all QRE ORM models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


@dataclass(frozen=True, slots=True)
class CheckResult:
    ok: bool
    detail: str


class Database:
    """Owns the engine and session factory for the lifetime of the application."""

    def __init__(self, settings: Settings, *, application_name: str = "qre-api") -> None:
        self.settings = settings
        self.engine: AsyncEngine = create_async_engine(
            settings.database_url.get_secret_value(),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args={
                "server_settings": {
                    "application_name": application_name,
                    "statement_timeout": str(settings.api_statement_timeout_ms),
                    "timezone": "UTC",
                }
            },
        )
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def session(self) -> AsyncIterator[AsyncSession]:
        """FastAPI dependency body: one session per request, always closed."""
        async with self.sessionmaker() as session:
            yield session

    async def ping(self) -> CheckResult:
        """`SELECT 1` within the readiness timeout (LLD §13.6: DB reachable within 2 s)."""
        timeout = self.settings.readiness_db_timeout_ms / 1000
        try:
            async with asyncio.timeout(timeout):
                async with self.engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            return CheckResult(True, "reachable")
        except TimeoutError:
            return CheckResult(False, f"no response within {timeout:.1f}s")
        except Exception as exc:  # noqa: BLE001 — readiness must report, not raise
            return CheckResult(False, type(exc).__name__)

    async def current_revision(self) -> str | None:
        """Revision recorded in the database's ``alembic_version`` table (None if absent)."""
        async with self.engine.connect() as conn:
            exists = await conn.scalar(text("SELECT to_regclass('public.alembic_version')"))
            if exists is None:
                return None
            return await conn.scalar(text("SELECT version_num FROM alembic_version LIMIT 1"))

    async def migration_check(self) -> CheckResult:
        """LLD §13.6: migration head in the database must equal the code head."""
        expected = code_head_revision()
        try:
            actual = await self.current_revision()
        except Exception as exc:  # noqa: BLE001
            return CheckResult(False, f"cannot read revision ({type(exc).__name__})")
        if actual == expected:
            return CheckResult(True, f"at head {expected}")
        return CheckResult(False, f"database at {actual or 'none'}, code head {expected}")

    async def dispose(self) -> None:
        await self.engine.dispose()


@lru_cache
def code_head_revision() -> str | None:
    """Head revision of the Alembic scripts shipped with this code."""
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return ScriptDirectory.from_config(cfg).get_current_head()


async def set_tenant_guc(session: AsyncSession, tenant_id: str) -> None:
    """Bind the tenant for PostgreSQL RLS policies for the current transaction (PD-44)."""
    await session.execute(
        text("SELECT set_config('qre.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id}
    )
```


### 6.7 Correlation middleware — `backend/qre/gateway/middleware/correlation.py`

Gives every request an `X-Correlation-ID` (keeps a valid one sent by the client), returns it in the response, writes an access-log line and converts any unexpected crash into a safe 500 response that still carries the id, so a user can quote it to support.

```python
"""Correlation-id and access-log middleware (LLD §4.2.1 rule 2, §4.2.5).

* Accepts an inbound ``X-Correlation-ID`` matching ``^[A-Za-z0-9-]{8,64}$``; otherwise a new
  ULID is generated. The id is echoed on every response and bound to the logging context.
* Writes one JSON access-log line per request: method, route template, status, duration.
  Query strings are never logged (they may contain tokens).

Implemented as pure ASGI middleware so it also wraps streaming responses.
"""

from __future__ import annotations

import logging
import re
import time

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from qre.core.ids import new_ulid
from qre.core.logging import correlation_id_var

HEADER = "X-Correlation-ID"
_VALID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
access_log = logging.getLogger("qre.access")


def resolve_correlation_id(inbound: str | None) -> str:
    """Keep a well-formed inbound id, otherwise generate a ULID."""
    if inbound and _VALID.fullmatch(inbound):
        return inbound
    return new_ulid()


class CorrelationMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = None
        for key, value in scope.get("headers", []):
            if key == b"x-correlation-id":
                inbound = value.decode("latin-1")
                break
        corr_id = resolve_correlation_id(inbound)
        token = correlation_id_var.set(corr_id)
        scope.setdefault("state", {})["correlation_id"] = corr_id

        status_holder = {"status": 500, "started": False}
        started = time.perf_counter()

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                status_holder["started"] = True
                MutableHeaders(scope=message)[HEADER] = corr_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        except Exception as exc:
            # Unhandled error: answer here, while the correlation id is still bound, so the
            # 500 body and header carry it (LLD §4.2.4). Stack trace goes to the log only.
            if status_holder["started"]:
                raise
            from qre.gateway.problem import internal_error_response

            await internal_error_response(exc)(scope, receive, send_with_header)
        finally:
            route = scope.get("route")
            access_log.info(
                "request",
                extra={
                    "method": scope.get("method"),
                    "route": getattr(route, "path", scope.get("path")),
                    "status": status_holder["status"],
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            correlation_id_var.reset(token)
```


### 6.8 Error responses — `backend/qre/gateway/problem.py`

Turns exceptions into the LLD §10.2 `application/problem+json` body. Input validation errors become `400 VALIDATION_FAILED` with `field_errors` (FastAPI's default would be 422 with a different shape).

```python
"""Uniform ``application/problem+json`` error responses (LLD §10.2, RFC 9457 style).

Every error leaving the API has the same shape::

    {"type": ".../QUOTA_INSUFFICIENT", "code": "QUOTA_INSUFFICIENT", "title": "...",
     "status": 409, "detail": "...", "correlation_id": "...", "field_errors": []}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from qre.core.config import get_settings
from qre.core.errors import CATALOGUE, FieldError, QreError
from qre.core.logging import correlation_id_var
from qre.gateway.middleware.correlation import HEADER

log = logging.getLogger("qre.errors")

PROBLEM_MEDIA_TYPE = "application/problem+json"

_HTTP_STATUS_TO_CODE = {
    400: "MALFORMED_REQUEST",
    401: "AUTH_REQUIRED",
    403: "AUTH_FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
}


def problem_body(
    code: str,
    *,
    status: int | None = None,
    detail: str | None = None,
    field_errors: list[FieldError] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    spec = CATALOGUE[code]
    body: dict[str, Any] = {
        "type": f"{get_settings().error_type_base}{code}",
        "code": code,
        "title": spec.title,
        "status": status or spec.status,
        "detail": detail or spec.title,
        "correlation_id": correlation_id_var.get(),
        "field_errors": [fe.as_dict() for fe in (field_errors or [])],
    }
    if extra:
        body.update(extra)
    return body


def problem_response(
    code: str,
    *,
    status: int | None = None,
    detail: str | None = None,
    field_errors: list[FieldError] | None = None,
    headers: dict[str, str] | None = None,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    body = problem_body(code, status=status, detail=detail, field_errors=field_errors, extra=extra)
    all_headers = dict(headers or {})
    if body["correlation_id"]:
        all_headers[HEADER] = body["correlation_id"]
    return JSONResponse(
        body, status_code=body["status"], headers=all_headers, media_type=PROBLEM_MEDIA_TYPE
    )


def _field_name(loc: tuple[Any, ...]) -> str:
    # ('body', 'shots') -> 'shots'; ('query', 'page_size') -> 'page_size'
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "header", "cookie")]
    return ".".join(parts) or "body"


async def handle_qre_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, QreError)
    return problem_response(
        exc.code,
        detail=exc.detail,
        field_errors=exc.field_errors,
        headers=exc.headers,
        extra=exc.extra,
    )


async def handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = exc.errors()
    if any(err.get("type") == "json_invalid" for err in errors):
        return problem_response("MALFORMED_REQUEST")
    field_errors = [
        FieldError(
            field=_field_name(tuple(err.get("loc", ()))),
            code=str(err.get("type", "invalid")).upper(),
            message=str(err.get("msg", "Invalid value")),
        )
        for err in errors
    ]
    return problem_response("VALIDATION_FAILED", field_errors=field_errors)


async def handle_http_exception(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_STATUS_TO_CODE.get(exc.status_code, "MALFORMED_REQUEST")
    headers = dict(exc.headers or {})
    detail = None
    if exc.status_code == 405:
        detail = "The HTTP method is not allowed for this endpoint."
    return problem_response(code, status=exc.status_code, detail=detail, headers=headers)


def internal_error_response(exc: BaseException) -> JSONResponse:
    """500 response for unhandled exceptions; called by CorrelationMiddleware.

    The stack trace goes to the log only; the client gets the correlation id (LLD §4.2.4).
    """
    log.error("unhandled exception", exc_info=exc)
    return problem_response("INTERNAL_ERROR")


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(QreError, handle_qre_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    # Unhandled exceptions are converted by CorrelationMiddleware (see internal_error_response).
```


### 6.9 Health probes — `backend/qre/gateway/health.py`

`/healthz` (is the process alive?) and `/readyz` (can it serve traffic: configuration, database, migrations). Readiness returns 503 with the same JSON when a check fails.

```python
"""Liveness and readiness probes (LLD §13.6, API-SYS-01; REQ-N022).

* ``GET /healthz`` — process alive and event loop responsive. Never touches the database.
* ``GET /readyz``  — database reachable within QRE_READINESS_DB_TIMEOUT_MS, migration head in the
  database equals the code head, configuration valid. 200 when ready, 503 otherwise.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from qre.core.config import APP_VERSION
from qre.core.db import CheckResult, Database

router = APIRouter(tags=["system"])


class CheckOut(BaseModel):
    ok: bool
    detail: str


class LivenessOut(BaseModel):
    status: Literal["ok"]
    version: str
    time: datetime


class ReadinessOut(BaseModel):
    status: Literal["ready", "not_ready"]
    version: str
    environment: str
    time: datetime
    checks: dict[str, CheckOut]


@router.get("/healthz", response_model=LivenessOut, summary="Liveness probe")
async def healthz() -> LivenessOut:
    return LivenessOut(status="ok", version=APP_VERSION, time=datetime.now(UTC))


@router.get(
    "/readyz",
    response_model=ReadinessOut,
    summary="Readiness probe",
    responses={503: {"model": ReadinessOut, "description": "Not ready"}},
)
async def readyz(request: Request) -> JSONResponse:
    db: Database = request.app.state.db
    database = await db.ping()
    if database.ok:
        migrations = await db.migration_check()
    else:
        migrations = CheckResult(False, "skipped: database unreachable")
    checks = {
        "configuration": CheckOut(ok=True, detail="valid"),  # invalid config never starts
        "database": CheckOut(ok=database.ok, detail=database.detail),
        "migrations": CheckOut(ok=migrations.ok, detail=migrations.detail),
    }
    ready = all(c.ok for c in checks.values())
    body = ReadinessOut(
        status="ready" if ready else "not_ready",
        version=APP_VERSION,
        environment=db.settings.env.value,
        time=datetime.now(UTC),
        checks=checks,
    )
    return JSONResponse(body.model_dump(mode="json"), status_code=200 if ready else 503)
```


### 6.10 Application factory — `backend/qre/gateway/app.py`

Builds the FastAPI app in the LLD §13.7 order: configuration → logging → database pool → routers. API docs are served at `/api/v1/docs`, the OpenAPI document at `/api/v1/openapi.json`. CORS is added only if origins are configured (same-origin needs none).

```python
"""FastAPI application factory (LLD §4.2, §13.7 start-up order).

Start-up: validate configuration → logging → database pool → mount routers → ready.
Routers for each service are added here phase by phase under the ``/api/v1`` prefix.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from qre.core.config import APP_VERSION, Settings, get_settings
from qre.core.db import Database
from qre.core.logging import configure_logging
from qre.gateway import health
from qre.gateway.middleware.correlation import CorrelationMiddleware
from qre.gateway.problem import install_problem_handlers

API_PREFIX = "/api/v1"
log = logging.getLogger("qre.app")


def build_api_router() -> APIRouter:
    """Versioned API router. Service routers are included here as phases land."""
    router = APIRouter(prefix=API_PREFIX)
    # Phase 3+: router.include_router(svc02_identity.api.router) …
    return router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()  # raises on invalid configuration (LLD §13.9)
    configure_logging(settings.log_level, settings.log_format.value)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.db = Database(settings)
        log.info("api starting", extra={"env": settings.env.value, "version": APP_VERSION})
        try:
            yield
        finally:
            await app.state.db.dispose()
            log.info("api stopped")

    app = FastAPI(
        title="Quantum Resource Portal API",
        version=APP_VERSION,
        summary="QRE governance workspace (QRP) — versioned JSON API",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings

    install_problem_handlers(app)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,  # explicit list only, never "*"
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=[
                "Content-Type",
                "X-CSRF-Token",
                "Idempotency-Key",
                "If-Match",
                "X-Correlation-ID",
            ],
            expose_headers=["X-Correlation-ID", "Retry-After"],
        )
    # Added last = outermost: every response (including CORS and errors) gets a correlation id.
    app.add_middleware(CorrelationMiddleware)

    app.include_router(health.router)
    app.include_router(build_api_router())
    return app
```


### 6.11 Entry points

**`backend/qre/main.py`** — what uvicorn loads.

```python
"""ASGI entry point.

Run in development from the ``backend/`` directory::

    uvicorn qre.main:app --reload --port 8000
"""

from qre.gateway.app import create_app

app = create_app()
```


**`backend/qre/__main__.py`** — `python -m qre config-check` validates and prints the configuration.

```python
"""Command-line helpers: ``python -m qre <command>``.

Commands
    config-check   Validate configuration and print it with secrets masked (LLD §13.9).
"""

from __future__ import annotations

import json
import sys

from pydantic import ValidationError


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "help"
    if command == "config-check":
        from qre.core.config import get_settings

        try:
            settings = get_settings()
        except ValidationError as exc:
            print("Configuration is INVALID:\n", file=sys.stderr)
            for err in exc.errors():
                where = ".".join(str(p) for p in err["loc"]) or "settings"
                print(f"  - {where}: {err['msg']}", file=sys.stderr)
            return 2
        print(json.dumps(settings.masked(), indent=2))
        print("\nConfiguration is valid.", file=sys.stderr)
        return 0
    print(__doc__)
    return 0 if command == "help" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```


### 6.12 Environment file

**`backend/.env.example`** — committed template. Copy it to `.env` (ignored by Git):

```bash
# QRP backend configuration — copy to `.env` and adjust.
# Variable names and defaults follow LLD Appendix D. Never commit the real `.env`.

# Profile: lab | production (HLD §9)
QRE_ENV=lab

# PostgreSQL DSN. The driver part must be `postgresql+asyncpg`.
# Lab: local database created in the Phase 1 guide (step 9).
QRE_DATABASE_URL=postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre

# Separate database used by the automated tests (it is wiped by the test suite).
QRE_TEST_DATABASE_URL=postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre_test

# Public URL the browser uses; in development the Vite dev server proxies /api to the backend.
QRE_PUBLIC_BASE_URL=http://localhost:5173

# Comma-separated allowed origins. Same-origin deployment needs none (PD-34).
QRE_CORS_ORIGINS=

QRE_LOG_LEVEL=INFO
QRE_LOG_FORMAT=json

# Sessions (Phase 3; Pending OI-05)
QRE_SESSION_IDLE_MIN=30
QRE_SESSION_ABSOLUTE_H=12
QRE_MFA_REQUIRED=false

# Pagination (PD-07)
QRE_PAGE_SIZE_DEFAULT=25
QRE_PAGE_SIZE_MAX=200

# Request limits (PD-46)
QRE_MAX_BODY_MB=10
QRE_MAX_UPLOAD_MB=50

# Readiness probe database timeout (LLD §13.6)
QRE_READINESS_DB_TIMEOUT_MS=2000

# Feature flags (LLD Appendix D)
# SVC-05 Procurement & Entitlements is Pending Approval (OI-01). Disabled endpoints return 501.
QRE_FEATURE_SVC05_ENABLED=false
# PostgreSQL row-level security as second isolation layer (PD-44, Pending Approval)
QRE_RLS_ENABLED=false
```


```bash
cp .env.example .env
python -m qre config-check
```

**Expected output:** the configuration as JSON with `"database_url": "postgresql+asyncpg://qre_app:***@localhost:5432/qre"`, then `Configuration is valid.`

**`backend/seeds/README.md`**

```markdown
# Demo data seeds

Phase 3 adds `seed_demo.py`, which loads the DEMO tenant (LLD-separated, labelled DEMO DATA).
It refuses to run when `QRE_ENV=production`.
```


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

```json
{
  "name": "qrp-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "oxlint",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@hookform/resolvers": "^7.0.1",
    "@tanstack/react-query": "^5.105.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.66.0",
    "motion": "^14.9.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-hook-form": "^7.91.0",
    "react-router": "^8.5.1",
    "recharts": "^3.10.1",
    "tailwind-merge": "^3.7.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.64.1",
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.8",
    "@types/node": "^24.19.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "@vitest/coverage-v8": "^5.0.5",
    "jsdom": "^30.1.3",
    "oxlint": "^1.89.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~7.0.2",
    "vite": "^8.3.5",
    "vitest": "^5.0.5"
  },
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  }
}
```


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

```ts
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend address used by the dev-server proxy. The browser only ever talks to the Vite origin,
// so session cookies stay same-origin (LLD PD-34) and no CORS configuration is needed.
const API_TARGET = process.env.QRP_API_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/healthz': { target: API_TARGET, changeOrigin: false },
      '/readyz': { target: API_TARGET, changeOrigin: false },
    },
  },
  preview: { port: 4173 },
})
```


**`frontend/vitest.config.ts`** — unit tests run in a simulated browser (jsdom).

```ts
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }),
)
```


**`frontend/tsconfig.app.json`** — strict TypeScript and the `@/*` path alias.

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client", "@testing-library/jest-dom/vitest"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Path alias: import from '@/…' instead of long relative paths */
    "paths": { "@/*": ["./src/*"] },

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```


**`frontend/tsconfig.node.json`** — TypeScript settings for the config files and Playwright tests.

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "e2e"]
}
```


### 8.2 shadcn/ui

shadcn/ui is not a package you import: its CLI copies component source files into `src/components/ui/`. It needs two things, which we create by hand so the result is predictable:

**`frontend/components.json`** — tells the CLI where components, utilities and the CSS file live.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```


**`frontend/src/lib/utils.ts`** — the `cn()` helper every shadcn component uses.

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names; later Tailwind utilities win over earlier conflicting ones (shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```


Components are added in Phase 2 with e.g. `npx shadcn@latest add button card dialog`. **Do not run `npx shadcn init`**: it would overwrite the design tokens below.

### 8.3 Design tokens — `frontend/src/styles/index.css`

The colour palette, fonts, radius and shadows from the design concept (docs §5.1), wired into Tailwind v4 (`@theme inline`) so classes like `bg-surface`, `text-success-text` and `shadow-card` work. Important detail: in shadcn, `--accent` and `--secondary` are *subtle hover surfaces*, so they are tints of blue here, and the brand violet and cyan are separate tokens (`--brand-violet`, `--brand-cyan`). Status colours have a darker `*-text` variant so badge text meets WCAG AA contrast.

```css
/*
 * QRP design tokens (docs/00_REQUIREMENTS_AND_DESIGN.md §5.1).
 *
 * Two layers:
 *  1. Brand palette  — the colours from the design brief (--brand-*, status colours).
 *  2. shadcn/ui semantic tokens — what components use (--primary, --accent, --muted …).
 *     In shadcn, --accent and --secondary are *subtle surfaces* for hovers and secondary
 *     buttons, so they are tints here; the brand violet and cyan are exposed separately.
 *
 * Fonts are self-hosted (@fontsource) because the LLD CSP allows only 'self' (LLD §11.6).
 */
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@fontsource-variable/inter';
@import '@fontsource-variable/jetbrains-mono';

@custom-variant dark (&:is(.dark *));

:root {
  /* Brand palette */
  --brand-primary: #536dfe;
  --brand-violet: #7957e8;
  --brand-cyan: #20b8d5;
  --brand-gradient: linear-gradient(135deg, #536dfe 0%, #7957e8 100%);

  /* Surfaces and text */
  --background: #ffffff;
  --surface: #f7f9fc;
  --foreground: #172033;
  --card: #ffffff;
  --card-foreground: #172033;
  --popover: #ffffff;
  --popover-foreground: #172033;

  /* shadcn semantic tokens */
  --primary: #536dfe;
  --primary-foreground: #ffffff;
  --secondary: #f1f3f9;
  --secondary-foreground: #172033;
  --muted: #f1f3f9;
  --muted-foreground: #788397;
  --accent: #eef1ff;
  --accent-foreground: #3a4fd6;
  --destructive: #e05252;
  --border: #e8ecf3;
  --input: #e8ecf3;
  --ring: #536dfe;

  /* Status colours: solid (icons, bars) / soft (badge background) / text (AA on soft) */
  --success: #16a36a;
  --success-soft: #e7f6ef;
  --success-text: #0e7a4f;
  --warning: #e9a23b;
  --warning-soft: #fdf4e6;
  --warning-text: #925c0e;
  --critical: #e05252;
  --critical-soft: #fcebeb;
  --critical-text: #b33636;
  --info: #20b8d5;
  --info-soft: #e6f7fa;
  --info-text: #0b7286;

  /* Charts: series order primary → violet → cyan → green → amber */
  --chart-1: #536dfe;
  --chart-2: #7957e8;
  --chart-3: #20b8d5;
  --chart-4: #16a36a;
  --chart-5: #e9a23b;

  /* Sidebar */
  --sidebar: #ffffff;
  --sidebar-foreground: #172033;
  --sidebar-primary: #536dfe;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eef1ff;
  --sidebar-accent-foreground: #3a4fd6;
  --sidebar-border: #e8ecf3;
  --sidebar-ring: #536dfe;

  --radius: 0.75rem;
}

@theme inline {
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SFMono-Regular', monospace;

  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-brand-primary: var(--brand-primary);
  --color-brand-violet: var(--brand-violet);
  --color-brand-cyan: var(--brand-cyan);

  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-text: var(--success-text);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-text: var(--warning-text);
  --color-critical: var(--critical);
  --color-critical-soft: var(--critical-soft);
  --color-critical-text: var(--critical-text);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-info-text: var(--info-text);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: calc(var(--radius) - 6px);
  --radius-md: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-card: 0 1px 2px rgb(23 32 51 / 0.04), 0 4px 16px rgb(23 32 51 / 0.06);
  --shadow-raised: 0 2px 4px rgb(23 32 51 / 0.05), 0 12px 32px rgb(23 32 51 / 0.1);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    color-scheme: light;
  }
  body {
    @apply bg-surface text-foreground font-sans antialiased;
    font-feature-settings: 'cv11', 'ss01';
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-ring;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```


### 8.4 Application code

**`frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Quantum Resource Portal — QRE governance workspace" />
    <title>QRP · Quantum Resource Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```


**`frontend/public/favicon.svg`** — QRP logo mark.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#536DFE"/><stop offset="1" stop-color="#7957E8"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#g)"/><path d="M20 8 31 16 20 32 9 16Z" fill="#fff" fill-opacity=".95"/><path d="M9 16h22L20 32Z" fill="#20B8D5" fill-opacity=".55"/><path d="M20 8 25 16H15Z" fill="#fff"/></svg>
```


**`frontend/src/main.tsx`** — mounts React with the providers and router.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import '@/styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
```


**`frontend/src/app/providers.tsx`** — TanStack Query client: caching, and no automatic retries for 4xx errors.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { ApiError } from '@/api/client'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Never retry client errors (4xx); retry network/5xx twice.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  })
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```


**`frontend/src/app/router.tsx`** — routes (only the status page for now).

```tsx
import { createBrowserRouter, Navigate } from 'react-router'

import { StatusPage } from '@/pages/system/StatusPage'

/**
 * Route table. Phase 2 adds the application shell (/login, /qrp/*) and makes `/` open the
 * governance dashboard; the status page then moves under Settings.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/system/status" replace /> },
  { path: '/system/status', element: <StatusPage /> },
  { path: '*', element: <Navigate to="/system/status" replace /> },
])
```


**`frontend/src/components/brand/LogoMark.tsx`**

```tsx
import { useId } from 'react'

/** QRP logo mark: a faceted gem (original artwork) using the brand gradient. */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="QRP">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#536DFE" />
          <stop offset="1" stopColor="#7957E8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
      <path d="M20 8 31 16 20 32 9 16Z" fill="#fff" fillOpacity=".95" />
      <path d="M9 16h22L20 32Z" fill="#20B8D5" fillOpacity=".55" />
      <path d="M20 8 25 16H15Z" fill="#fff" />
    </svg>
  )
}
```


**`frontend/src/components/status/StatusBadge.tsx`** — the status badge used everywhere: icon + text + colour, never colour alone (REQ-004, REQ-N031).

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Status indicator that never relies on colour alone: icon + text + colour (REQ-004, REQ-N031).
 * Text is uppercase by convention (e.g. ACTIVE, DEGRADED) and always readable by screen readers.
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'bg-success-soft text-success-text',
        warning: 'bg-warning-soft text-warning-text',
        critical: 'bg-critical-soft text-critical-text',
        info: 'bg-info-soft text-info-text',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const ICONS: Record<NonNullable<VariantProps<typeof badge>['tone']>, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
  info: Info,
  neutral: CircleDashed,
}

export type StatusTone = keyof typeof ICONS

export interface StatusBadgeProps extends VariantProps<typeof badge> {
  label: string
  className?: string
}

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  const Icon = ICONS[tone ?? 'neutral']
  return (
    <span className={cn(badge({ tone }), className)}>
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {label}
    </span>
  )
}
```


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

```ini
# Alembic configuration for the QRP backend (LLD §7.9).
# The database URL is NOT stored here: migrations/env.py reads QRE_DATABASE_URL via qre.core.config.

[alembic]
script_location = %(here)s/migrations
prepend_sys_path = .
file_template = %%(year)d%%(month).2d%%(day).2d_%%(rev)s_%%(slug)s
truncate_slug_length = 40
timezone = UTC
path_separator = os

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```


**`backend/migrations/env.py`** — runs migrations with the async driver and takes the database URL from `QRE_DATABASE_URL` (not from `alembic.ini`, so no password is stored there).

```python
"""Alembic environment (async, asyncpg).

URL resolution order:
1. ``sqlalchemy.url`` set programmatically (used by the test suite for the test database);
2. ``QRE_DATABASE_URL`` from the environment or ``backend/.env``.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from qre.core.db import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url
    from qre.core.config import get_settings

    return get_settings().database_url.get_secret_value()


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of executing it (``alembic upgrade head --sql``)."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(_database_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(_run_sync)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```


**`backend/migrations/script.py.mako`** — template for new revision files.

```python
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```


**`backend/migrations/versions/20261102_0001_baseline.py`**

```python
"""Baseline: extensions, append-only trigger function and the tenant table.

Source: LLD v1.1.0 Appendix B (statements copied verbatim). Later phases add their tables in
separate revisions so each phase can be migrated and verified on its own.

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Needed by the reservation exclusion constraint (SVC-07, LLD §4.8.1).
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # Used by triggers on approval_decision and audit_log (append-only, REQ-040, REQ-008).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$;
        """
    )

    # tenant: Isolation boundary for users, projects, backends and policies.
    op.execute(
        """
        CREATE TABLE tenant (
            tenant_id CHAR(26) NOT NULL,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            settings JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_tenant PRIMARY KEY (tenant_id),
            CONSTRAINT uq_tenant_1 UNIQUE (code)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tenant")
    op.execute("DROP FUNCTION IF EXISTS qre_append_only()")
    # btree_gist is left installed: other objects in the database may depend on it.
```


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

```ts
/**
 * Minimal API client for the QRE backend (LLD §8.1, §10.2).
 *
 * - Same-origin requests only; the session cookie is sent automatically (credentials: same-origin).
 *   Nothing is ever written to localStorage (LLD §11.6).
 * - Error responses in application/problem+json become `ApiError` with code, title, detail,
 *   correlation id and field errors, so screens can show the message and the support reference.
 * - CSRF header injection and the 401 re-authentication flow are added in Phase 3.
 */

export interface FieldError {
  field: string
  code: string
  message: string
}

export interface ProblemBody {
  type?: string
  code: string
  title: string
  status: number
  detail?: string
  correlation_id?: string | null
  field_errors?: FieldError[]
}

/** Client-side codes for failures that never reached the API (not part of the LLD catalogue). */
export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  unexpectedResponse: 'UNEXPECTED_RESPONSE',
} as const

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly title: string
  readonly detail: string
  readonly correlationId: string | null
  readonly fieldErrors: FieldError[]

  constructor(problem: ProblemBody, correlationId: string | null = null) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code
    this.title = problem.title
    this.detail = problem.detail ?? problem.title
    this.correlationId = problem.correlation_id ?? correlationId
    this.fieldErrors = problem.field_errors ?? []
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serialisable body; sets Content-Type automatically. */
  json?: unknown
  /** Extra statuses (besides 2xx) whose JSON body is returned instead of thrown, e.g. 503 from /readyz. */
  acceptStatuses?: number[]
}

export interface ApiResponse<T> {
  status: number
  data: T
  correlationId: string | null
}

const PROBLEM_TYPE = 'application/problem+json'

async function toApiError(response: Response): Promise<ApiError> {
  const correlationId = response.headers.get('X-Correlation-ID')
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes(PROBLEM_TYPE) || contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Partial<ProblemBody>
      if (body && typeof body.code === 'string') {
        return new ApiError(
          { ...body, status: body.status ?? response.status } as ProblemBody,
          correlationId,
        )
      }
    } catch {
      // fall through to the generic error below
    }
  }
  return new ApiError(
    {
      code: CLIENT_ERROR_CODES.unexpectedResponse,
      title: 'The server returned an unexpected response.',
      status: response.status,
    },
    correlationId,
  )
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { json, acceptStatuses = [], headers, ...init } = options
  const finalHeaders = new Headers(headers)
  finalHeaders.set('Accept', 'application/json')
  let body: BodyInit | undefined
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init, headers: finalHeaders, body })
  } catch {
    throw new ApiError({
      code: CLIENT_ERROR_CODES.network,
      title: 'The QRP API could not be reached.',
      detail: 'Check that the backend is running and your network connection is available.',
      status: 0,
    })
  }

  if (!response.ok && !acceptStatuses.includes(response.status)) {
    throw await toApiError(response)
  }
  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  return { status: response.status, data, correlationId: response.headers.get('X-Correlation-ID') }
}

/** Convenience wrapper returning only the body. */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequest<T>(path, { ...options, method: 'GET' })).data
}
```


**`frontend/src/api/system.ts`** — typed calls for `/healthz` and `/readyz`.

```ts
import { apiGet, apiRequest } from '@/api/client'

/** GET /healthz — liveness (LLD §13.6). */
export interface Liveness {
  status: 'ok'
  version: string
  time: string
}

export interface Check {
  ok: boolean
  detail: string
}

/** GET /readyz — readiness; 200 when ready, 503 with the same body when not. */
export interface Readiness {
  status: 'ready' | 'not_ready'
  version: string
  environment: string
  time: string
  checks: Record<string, Check>
}

export const systemKeys = {
  liveness: ['system', 'liveness'] as const,
  readiness: ['system', 'readiness'] as const,
}

export function fetchLiveness(): Promise<Liveness> {
  return apiGet<Liveness>('/healthz')
}

export async function fetchReadiness(): Promise<Readiness> {
  const response = await apiRequest<Readiness>('/readyz', { acceptStatuses: [503] })
  return response.data
}
```


**`frontend/src/pages/system/StatusPage.tsx`** — the platform status page. It shows the whole path browser → Vite proxy → FastAPI → PostgreSQL → migrations, refreshing every 15 seconds, with a recovery hint when the API is down.

```tsx
import { useQuery } from '@tanstack/react-query'
import { Activity, Database, GitBranch, RefreshCw, Settings2, Server, type LucideIcon } from 'lucide-react'

import { ApiError } from '@/api/client'
import { fetchLiveness, fetchReadiness, systemKeys, type Check } from '@/api/system'
import { LogoMark } from '@/components/brand/LogoMark'
import { StatusBadge } from '@/components/status/StatusBadge'
import { cn } from '@/lib/utils'

const CHECK_META: Record<string, { label: string; icon: LucideIcon }> = {
  configuration: { label: 'Configuration', icon: Settings2 },
  database: { label: 'PostgreSQL database', icon: Database },
  migrations: { label: 'Schema migrations', icon: GitBranch },
}

const REFRESH_MS = 15_000

function formatTime(iso: string | undefined) {
  if (!iso) return 'Unavailable'
  const date = new Date(iso)
  return `${date.toLocaleTimeString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-6 shadow-card', className)}>
      {children}
    </section>
  )
}

function CheckRow({ name, check }: { name: string; check: Check }) {
  const meta = CHECK_META[name] ?? { label: name, icon: Server }
  const Icon = meta.icon
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{check.detail}</p>
      </div>
      <StatusBadge tone={check.ok ? 'success' : 'critical'} label={check.ok ? 'OK' : 'Failing'} />
    </li>
  )
}

/**
 * Platform status (development diagnostics): proves the browser → Vite proxy → FastAPI →
 * PostgreSQL path works. Moves under Settings → System in Phase 7.
 */
export function StatusPage() {
  const liveness = useQuery({
    queryKey: systemKeys.liveness,
    queryFn: fetchLiveness,
    refetchInterval: REFRESH_MS,
  })
  const readiness = useQuery({
    queryKey: systemKeys.readiness,
    queryFn: fetchReadiness,
    refetchInterval: REFRESH_MS,
  })

  const refreshing = liveness.isFetching || readiness.isFetching
  const apiError = liveness.error instanceof ApiError ? liveness.error : null
  const ready = readiness.data?.status === 'ready'

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <LogoMark className="size-11" />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Quantum Resource Portal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Platform status</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            void liveness.refetch()
            void readiness.refetch()
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-card transition hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw aria-hidden="true" className={cn('size-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </header>

      {apiError ? (
        <Card className="border-critical/30">
          <div className="flex items-start gap-4">
            <StatusBadge tone="critical" label="Unreachable" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{apiError.title}</p>
              <p className="text-muted-foreground">
                Start the backend (<code className="font-mono">make dev-api</code>) and press Refresh.
              </p>
              {apiError.correlationId && (
                <p className="font-mono text-xs text-muted-foreground">Ref {apiError.correlationId}</p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-(image:--brand-gradient)" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity aria-hidden="true" className="size-4" /> API liveness
            </div>
            <div className="mt-3">
              {liveness.isPending ? (
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              ) : (
                <StatusBadge tone="success" label="Alive" />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Server time {formatTime(liveness.data?.time)}</p>
          </Card>
          <Card>
            <div className="text-sm text-muted-foreground">Readiness</div>
            <div className="mt-3">
              {readiness.isPending ? (
                <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              ) : (
                <StatusBadge tone={ready ? 'success' : 'critical'} label={ready ? 'Ready' : 'Not ready'} />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Checked {formatTime(readiness.data?.time)}
            </p>
          </Card>
          <Card>
            <div className="text-sm text-muted-foreground">Build</div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {liveness.data?.version ?? '—'}
            </p>
            <div className="mt-2">
              <StatusBadge
                tone="info"
                label={`${(readiness.data?.environment ?? 'unknown').toUpperCase()} profile`}
              />
            </div>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="text-base font-semibold">Readiness checks</h2>
        <p className="text-sm text-muted-foreground">
          From <code className="font-mono text-xs">GET /readyz</code> · refreshes every 15 seconds
        </p>
        {readiness.data ? (
          <ul className="mt-2 divide-y divide-border">
            {Object.entries(readiness.data.checks).map(([name, check]) => (
              <CheckRow key={name} name={name} check={check} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {readiness.isPending ? 'Loading…' : 'Readiness information is unavailable.'}
          </p>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        API documentation:{' '}
        <a className="font-medium text-primary underline-offset-4 hover:underline" href="/api/v1/docs">
          /api/v1/docs
        </a>
      </p>
    </main>
  )
}
```


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

```python
"""Shared test fixtures.

Safety: before any application module is imported, ``QRE_DATABASE_URL`` is pointed at the
*test* database (``QRE_TEST_DATABASE_URL``), so the test suite can never touch development data.
Tests marked ``db`` are skipped with a clear message when the test database is unreachable.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_file_env = _read_env_file(BACKEND_DIR / ".env")
TEST_DATABASE_URL = os.environ.get("QRE_TEST_DATABASE_URL") or _file_env.get(
    "QRE_TEST_DATABASE_URL",
    "postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre_test",
)
os.environ["QRE_DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("QRE_ENV", "lab")
os.environ.setdefault("QRE_LOG_FORMAT", "text")
os.environ.setdefault("QRE_LOG_LEVEL", "WARNING")

# Imported only after the environment is prepared.
from alembic import command  # noqa: E402
from alembic.config import Config as AlembicConfig  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from qre.core.config import Settings, get_settings  # noqa: E402
from qre.gateway.app import create_app  # noqa: E402


def alembic_config(url: str = TEST_DATABASE_URL) -> AlembicConfig:
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.attributes["configure_logger"] = False
    return cfg


async def _database_reachable(url: str) -> bool:
    engine = create_async_engine(url)
    try:
        async with asyncio.timeout(3):
            async with engine.connect():
                return True
    except Exception:  # noqa: BLE001
        return False
    finally:
        await engine.dispose()


def run_alembic(fn, *args) -> None:
    """Alembic's env.py calls asyncio.run(); run it in a worker thread (no running loop there)."""
    import threading

    errors: list[BaseException] = []

    def target() -> None:
        try:
            fn(*args)
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    thread = threading.Thread(target=target)
    thread.start()
    thread.join()
    if errors:
        raise errors[0]


@pytest.fixture(scope="session")
def settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture(scope="session")
async def migrated_db() -> AsyncIterator[str]:
    """Fresh schema at head on the test database: downgrade to base, then upgrade to head."""
    if not await _database_reachable(TEST_DATABASE_URL):
        pytest.skip(
            "Test database not reachable. Create it (docs/PHASE_1_GUIDE.md, step 9) "
            "or set QRE_TEST_DATABASE_URL."
        )
    cfg = alembic_config()
    run_alembic(command.downgrade, cfg, "base")
    run_alembic(command.upgrade, cfg, "head")
    yield TEST_DATABASE_URL


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    """HTTP client against a fully started app (lifespan included)."""
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http:
            http.app = app  # type: ignore[attr-defined]  # lets tests add routes
            yield http
```


**`backend/tests/unit/test_ids.py`**

```python
from qre.core.ids import ULID_PATTERN, is_ulid, new_ulid


def test_ulid_format_is_26_crockford_chars():
    value = new_ulid()
    assert len(value) == 26
    assert ULID_PATTERN.fullmatch(value)
    assert is_ulid(value)


def test_is_ulid_rejects_lowercase_and_excluded_letters():
    assert not is_ulid("01jd3q7a0b1c2d3e4f5g6h7j8k")  # lower case
    assert not is_ulid("01JD3Q7A0B1C2D3E4F5G6H7J8I")  # I is not Crockford
    assert not is_ulid("too-short")


def test_ulids_are_unique_and_monotonic():
    values = [new_ulid() for _ in range(50_000)]
    assert len(set(values)) == len(values)
    assert values == sorted(values)
```


**`backend/tests/unit/test_config.py`**

```python
import pytest
from pydantic import ValidationError

from qre.core.config import Profile, Settings

DSN = "postgresql+asyncpg://qre_app:secret@localhost:5432/qre"


def make(**kwargs) -> Settings:
    return Settings(_env_file=None, database_url=kwargs.pop("database_url", DSN), **kwargs)


def test_defaults_follow_appendix_d():
    s = make()
    assert s.env is Profile.LAB
    assert (s.page_size_default, s.page_size_max) == (25, 200)
    assert (s.session_idle_min, s.session_absolute_h) == (30, 12)
    assert s.feature_svc05_enabled is False
    assert s.rls_enabled is False


def test_sync_driver_is_rejected():
    with pytest.raises(ValidationError, match="postgresql\\+asyncpg"):
        make(database_url="postgresql://u:p@localhost/qre")


def test_cors_origins_parsed_from_comma_list():
    s = make(cors_origins="https://a.example, https://b.example")
    assert s.cors_origins == ["https://a.example", "https://b.example"]


def test_page_size_cross_field_rule():
    with pytest.raises(ValidationError, match="PAGE_SIZE_DEFAULT"):
        make(page_size_default=150, page_size_max=100)


def test_production_requires_explicit_security_settings():
    with pytest.raises(ValidationError) as exc:
        make(env="production")
    message = str(exc.value)
    assert "QRE_MFA_REQUIRED" in message
    assert "TLS" in message
    assert "QRE_CORS_ORIGINS" in message


def test_production_accepts_complete_configuration():
    s = make(
        env="production",
        database_url=DSN + "?ssl=verify-full",
        mfa_required=True,
        cors_origins="https://qre.example",
    )
    assert s.env is Profile.PRODUCTION


def test_masked_hides_database_password():
    masked = make().masked()
    assert "secret" not in masked["database_url"]
    assert masked["database_url"].startswith("postgresql+asyncpg://qre_app:***@")
```


**`backend/tests/unit/test_errors.py`**

```python
import pytest

from qre.core.errors import CATALOGUE, QreError, ResourceNotFound
from qre.core.logging import mask


def test_catalogue_has_all_48_appendix_c_codes():
    assert len(CATALOGUE) == 48


def test_unknown_code_is_a_programming_error():
    with pytest.raises(ValueError):
        QreError(code="NOT_A_CODE")


def test_subclass_carries_status_and_title():
    err = ResourceNotFound()
    assert err.status == 404
    assert err.spec.title == "The requested resource was not found."


def test_mask_replaces_secret_keys_recursively():
    data = {"password": "x", "nested": [{"api_key": "y", "ok": 1}], "Authorization": "Bearer z"}
    assert mask(data) == {
        "password": "***",
        "nested": [{"api_key": "***", "ok": 1}],
        "Authorization": "***",
    }
```


**`backend/tests/integration/test_gateway.py`** — correlation ids and every error path (404, domain error, validation, malformed JSON, unexpected crash with no leaked internals).

```python
"""Gateway behaviour that does not need a database: correlation ids and problem+json errors."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from qre.core.errors import QreError
from qre.core.ids import is_ulid


class _Body(BaseModel):
    shots: int = Field(gt=0)


def _add_test_routes(client) -> None:
    router = APIRouter(prefix="/__test__")

    @router.get("/qre-error")
    async def qre_error():
        raise QreError("Requested 51 shots; available 50.", code="QUOTA_INSUFFICIENT")

    @router.post("/validate")
    async def validate(body: _Body):
        return body

    @router.get("/boom")
    async def boom():
        raise RuntimeError("database password=hunter2 leaked?")

    client.app.include_router(router)


async def test_healthz_generates_correlation_id(client):
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert is_ulid(response.headers["X-Correlation-ID"])


async def test_valid_inbound_correlation_id_is_preserved(client):
    response = await client.get("/healthz", headers={"X-Correlation-ID": "trace-abc-12345"})
    assert response.headers["X-Correlation-ID"] == "trace-abc-12345"


async def test_malformed_inbound_correlation_id_is_replaced(client):
    response = await client.get("/healthz", headers={"X-Correlation-ID": "bad id!"})
    assert is_ulid(response.headers["X-Correlation-ID"])


async def test_unknown_route_returns_problem_json_404(client):
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "RESOURCE_NOT_FOUND"
    assert body["correlation_id"] == response.headers["X-Correlation-ID"]


async def test_domain_error_uses_catalogue_status_and_detail(client):
    _add_test_routes(client)
    response = await client.get("/__test__/qre-error")
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "QUOTA_INSUFFICIENT"
    assert body["type"].endswith("/QUOTA_INSUFFICIENT")
    assert body["detail"] == "Requested 51 shots; available 50."


async def test_validation_error_is_400_with_field_errors(client):
    _add_test_routes(client)
    response = await client.post("/__test__/validate", json={"shots": 0})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_FAILED"
    assert body["field_errors"][0]["field"] == "shots"


async def test_malformed_json_is_reported_as_malformed_request(client):
    _add_test_routes(client)
    response = await client.post(
        "/__test__/validate", content=b"{not json", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"


async def test_unhandled_exception_hides_internals(client):
    _add_test_routes(client)
    response = await client.get("/__test__/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "hunter2" not in response.text
    assert body["correlation_id"] == response.headers["X-Correlation-ID"]


async def test_openapi_is_served_under_api_v1(client):
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Quantum Resource Portal API"
```


**`backend/tests/integration/test_database.py`** — readiness at head, with pending migrations, with an unreachable database, and the baseline schema objects.

```python
"""Readiness and baseline schema against a real PostgreSQL test database."""

import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from qre.core.config import Settings
from qre.gateway.app import create_app
from tests.conftest import alembic_config, run_alembic

pytestmark = pytest.mark.db


async def test_readyz_is_ready_at_migration_head(migrated_db, client):
    response = await client.get("/readyz")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"]["ok"] is True
    assert body["checks"]["migrations"]["detail"].startswith("at head")


async def test_readyz_reports_pending_migrations(migrated_db, client):
    cfg = alembic_config()
    run_alembic(command.downgrade, cfg, "base")
    try:
        response = await client.get("/readyz")
        assert response.status_code == 503
        checks = response.json()["checks"]
        assert checks["database"]["ok"] is True
        assert checks["migrations"]["ok"] is False
    finally:
        run_alembic(command.upgrade, cfg, "head")


async def test_readyz_reports_unreachable_database(settings):
    broken = Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://nobody:nothing@127.0.0.1:1/none",
        readiness_db_timeout_ms=500,
    )
    from httpx import ASGITransport, AsyncClient

    app = create_app(broken)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as http:
            response = await http.get("/readyz")
    assert response.status_code == 503
    body = response.json()
    assert body["checks"]["database"]["ok"] is False
    assert body["checks"]["migrations"]["detail"].startswith("skipped")


async def test_baseline_schema_objects_exist(migrated_db):
    engine = create_async_engine(migrated_db)
    try:
        async with engine.connect() as conn:
            assert await conn.scalar(text("SELECT to_regclass('public.tenant')")) == "tenant"
            ext = await conn.scalar(
                text("SELECT extname FROM pg_extension WHERE extname = 'btree_gist'")
            )
            assert ext == "btree_gist"
            fn = await conn.scalar(
                text("SELECT proname FROM pg_proc WHERE proname = 'qre_append_only'")
            )
            assert fn == "qre_append_only"
            constraints = set(
                (
                    await conn.execute(
                        text(
                            "SELECT conname FROM pg_constraint WHERE conrelid = 'tenant'::regclass"
                        )
                    )
                ).scalars()
            )
            assert {"pk_tenant", "uq_tenant_1"} <= constraints
    finally:
        await engine.dispose()
```


```bash
cd ~/projects/quantum-resource-portal
make test-backend
```

**Expected output:** `27 passed`. You can also run them from VS Code's **Testing** panel (flask icon).

### 14.2 Frontend tests

**`frontend/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
```


**`frontend/src/api/client.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'

import { ApiError, apiGet, apiRequest, CLIENT_ERROR_CODES } from '@/api/client'

function jsonResponse(body: unknown, status: number, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType, 'X-Correlation-ID': '01JD3Q7A0B1C2D3E4F5G6H7J8K' },
  })
}

describe('apiRequest', () => {
  it('returns the body and correlation id on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'ok' }, 200))
    const result = await apiRequest<{ status: string }>('/healthz')
    expect(result.data.status).toBe('ok')
    expect(result.correlationId).toBe('01JD3Q7A0B1C2D3E4F5G6H7J8K')
  })

  it('turns problem+json into ApiError with code, detail and field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_FAILED',
          title: 'One or more fields are invalid. See field_errors.',
          status: 400,
          detail: 'One or more fields are invalid. See field_errors.',
          correlation_id: 'abc-123-correlation',
          field_errors: [{ field: 'shots', code: 'GREATER_THAN', message: 'must be > 0' }],
        },
        400,
        'application/problem+json',
      ),
    )
    const error = await apiGet('/api/v1/workloads').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('VALIDATION_FAILED')
    expect(apiError.status).toBe(400)
    expect(apiError.correlationId).toBe('abc-123-correlation')
    expect(apiError.fieldErrors[0].field).toBe('shots')
  })

  it('accepts listed non-2xx statuses (readiness 503)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'not_ready' }, 503))
    const result = await apiRequest<{ status: string }>('/readyz', { acceptStatuses: [503] })
    expect(result.status).toBe(503)
    expect(result.data.status).toBe('not_ready')
  })

  it('reports network failures as a client-side NETWORK_ERROR', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await apiGet('/healthz').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe(CLIENT_ERROR_CODES.network)
    expect(error.status).toBe(0)
  })

  it('sends same-origin credentials and JSON bodies', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await apiRequest('/api/v1/thing', { method: 'POST', json: { a: 1 } })
    const [, init] = spy.mock.calls[0]
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"a":1}')
  })
})
```


**`frontend/src/pages/system/StatusPage.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StatusPage } from '@/pages/system/StatusPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  )
}

function mockApi(readyStatus: 200 | 503) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/healthz')) {
      return Response.json({ status: 'ok', version: '0.1.0', time: '2026-11-02T07:00:00Z' })
    }
    return Response.json(
      {
        status: readyStatus === 200 ? 'ready' : 'not_ready',
        version: '0.1.0',
        environment: 'lab',
        time: '2026-11-02T07:00:00Z',
        checks: {
          configuration: { ok: true, detail: 'valid' },
          database: { ok: true, detail: 'reachable' },
          migrations: readyStatus === 200
            ? { ok: true, detail: 'at head 0001' }
            : { ok: false, detail: 'database at none, code head 0001' },
        },
      },
      { status: readyStatus },
    )
  })
}

describe('StatusPage', () => {
  it('shows a ready platform with text labels, not colour alone', async () => {
    mockApi(200)
    renderPage()
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Alive')).toBeInTheDocument()
    expect(screen.getByText('at head 0001')).toBeInTheDocument()
    expect(screen.getAllByText('OK')).toHaveLength(3)
  })

  it('shows failing checks when the API reports not ready', async () => {
    mockApi(503)
    renderPage()
    expect(await screen.findByText('Not ready')).toBeInTheDocument()
    expect(screen.getByText('Failing')).toBeInTheDocument()
  })

  it('explains how to recover when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    expect(await screen.findByText('Unreachable')).toBeInTheDocument()
    expect(screen.getByText('make dev-api')).toBeInTheDocument()
  })
})
```


```bash
make test-frontend
```

**Expected output:** `Test Files 2 passed (2)` · `Tests 8 passed (8)`.

### 14.3 End-to-end tests (real browser)

**`frontend/playwright.config.ts`** — runs each test at desktop and phone size.

```ts
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the Vite dev server, which proxies to a running backend.
 * Start the backend first (make dev-api); Playwright starts Vite itself if it is not running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
```


**`frontend/e2e/status.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test('platform status shows the full browser → API → database path as ready', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/system\/status$/)
  await expect(page.getByRole('heading', { name: 'Platform status' })).toBeVisible()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible()
  await expect(page.getByText('PostgreSQL database')).toBeVisible()
  await expect(page.getByText(/^at head /)).toBeVisible()

  // No horizontal scrolling at any viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
```


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
