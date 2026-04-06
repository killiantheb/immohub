# CATHY — Makefile
# Requires: make, docker, docker-compose, python 3.12+, node 20+
# On Windows: run from Git Bash or WSL

.PHONY: dev dev-build stop logs migrate migrate-create test lint lint-backend lint-frontend format clean help

# ── Local dev (Docker) ────────────────────────────────────────────────────────

dev:			## Start all services with hot reload
	docker compose up

dev-build:		## Rebuild images then start
	docker compose up --build

stop:			## Stop all containers
	docker compose down

logs:			## Tail logs for all services
	docker compose logs -f

logs-backend:		## Tail backend logs only
	docker compose logs -f backend

# ── Database migrations ───────────────────────────────────────────────────────

migrate:		## Apply pending Alembic migrations
	cd backend && alembic upgrade head

migrate-create:		## Create a new migration (usage: make migrate-create MSG="add users table")
	cd backend && alembic revision --autogenerate -m "$(MSG)"

migrate-down:		## Rollback one migration
	cd backend && alembic downgrade -1

migrate-history:	## Show migration history
	cd backend && alembic history --verbose

# ── Tests ─────────────────────────────────────────────────────────────────────

test:			## Run backend tests
	cd backend && pytest -x -q

test-v:			## Run backend tests (verbose)
	cd backend && pytest -v

test-cov:		## Run tests with coverage report
	cd backend && pytest --cov=app --cov-report=term-missing -q

# ── Linting ───────────────────────────────────────────────────────────────────

lint: lint-backend lint-frontend	## Lint backend + frontend

lint-backend:		## Ruff lint + mypy
	cd backend && ruff check . && ruff format --check . && mypy app --ignore-missing-imports --no-strict-optional

lint-frontend:		## ESLint + TypeScript check
	cd frontend && npm run lint && npx tsc --noEmit

format:			## Auto-fix backend formatting
	cd backend && ruff check --fix . && ruff format .

# ── Install ───────────────────────────────────────────────────────────────────

install-backend:	## Install Python deps in local venv
	cd backend && pip install -r requirements.txt ruff mypy

install-frontend:	## Install Node deps
	cd frontend && npm ci

install: install-backend install-frontend	## Install all deps

# ── Utilities ─────────────────────────────────────────────────────────────────

clean:			## Remove Docker volumes (WARNING: deletes local DB data)
	docker compose down -v

shell-backend:		## Open a shell in the running backend container
	docker compose exec backend bash

shell-db:		## Open a psql shell
	docker compose exec postgres psql -U postgres -d immohub

help:			## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?##"}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
