SHELL := /bin/bash
API := apps/api
WEB := apps/web
UV := env -u UV_NATIVE_TLS uv

.PHONY: setup up down migrate seed dev dev-api dev-web types lint typecheck test e2e check reset-db

setup: ## Install deps for api + web and create .env
	@test -f .env || cp .env.example .env
	@test -f $(WEB)/.env.local || grep '^NEXT_PUBLIC_' .env.example > $(WEB)/.env.local
	cd $(API) && $(UV) sync
	cd $(WEB) && pnpm install

up: ## Start Postgres
	docker compose up -d --wait postgres

down:
	docker compose down

migrate: ## Apply migrations
	cd $(API) && $(UV) run alembic upgrade head

seed: migrate ## Load demo data (idempotent)
	cd $(API) && $(UV) run python -m app.seed

dev: ## Run api (:8000) and web (:3000) together
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(API) && $(UV) run uvicorn app.main:app --reload --port 8000) & \
	(cd $(WEB) && pnpm dev) & \
	wait

dev-api:
	cd $(API) && $(UV) run uvicorn app.main:app --reload --port 8000

dev-web:
	cd $(WEB) && pnpm dev

types: ## Regenerate web API types from the api OpenAPI schema
	cd $(API) && $(UV) run python -m app.openapi_export > ../web/openapi.json
	cd $(WEB) && pnpm exec openapi-typescript openapi.json -o src/lib/api/schema.d.ts && rm openapi.json

lint:
	cd $(API) && $(UV) run ruff check . && $(UV) run ruff format --check .
	cd $(WEB) && pnpm lint

typecheck:
	cd $(API) && $(UV) run mypy app
	cd $(WEB) && pnpm typecheck

test:
	cd $(API) && $(UV) run pytest -q
	cd $(WEB) && pnpm test

e2e:
	cd $(WEB) && pnpm e2e

check: lint typecheck test
