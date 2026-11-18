# Quantum Resource Portal — common development commands.
# Run `make help` to list them. All commands are run from the repository root.

SHELL := /bin/bash
VENV  := backend/.venv
PY    := $(VENV)/bin/python
QRP_API_PORT ?= 8010
QRP_UI_PORT  ?= 5176
QRP_API_TARGET ?= http://127.0.0.1:$(QRP_API_PORT)
QRE_DEMO_TENANT_CODE ?= CDAC

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

seed-demo:  ## Load interconnected demo dataset (QRE_ENV=lab, existing tenant)
	cd backend && QRE_ENV=lab .venv/bin/python -m qre seed-demo --tenant-code $(QRE_DEMO_TENANT_CODE)

dev-api:  ## Run the FastAPI backend with auto-reload on :8010 (not Q-TeleScope :8000)
	cd backend && .venv/bin/uvicorn qre.main:app --reload --host 127.0.0.1 --port $(QRP_API_PORT)

dev-web:  ## Run the Vite dev server on :5176 (proxies /api to :8010)
	cd frontend && QRP_API_TARGET=$(QRP_API_TARGET) npm run dev -- --host 127.0.0.1 --port $(QRP_UI_PORT)

dev-vm:  ## Start API + Vite on the VM (captcha-safe; verifies /auth/captcha)
	bash scripts/vm-setup.sh

verify-stack:  ## Smoke-test API :8010 + Vite proxy :5176 (QRP endpoints only)
	bash scripts/verify-qrp-stack.sh

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
