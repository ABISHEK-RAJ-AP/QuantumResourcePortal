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
