SHELL := /bin/bash
API := apps/api
WEB := apps/web
UV := env -u UV_NATIVE_TLS uv

.PHONY: setup up down migrate seed dev dev-api dev-web types lint typecheck test e2e check reset-db \
	docker-build compose-up compose-down k3d-up k3d-load k8s-secrets k8s-deploy k8s-seed k8s-status k3d-down

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
	cd $(WEB) && pnpm exec openapi-typescript openapi.json --default-non-nullable false -o src/lib/api/schema.d.ts && rm openapi.json

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

# ---- containers & Kubernetes (step-by-step guide: docs/deploy.md) --------------------------
K8S := deploy/k8s
CLUSTER := halo

docker-build: ## Build the api and web images (tag :local)
	docker build -t halo-api:local $(API)
	docker build -t halo-web:local $(WEB)

compose-up: ## Production-like stack on http://localhost:8080 (Docker Compose)
	@test -f deploy/compose/.env || { echo "JWT_SECRET=$$(openssl rand -hex 32)" > deploy/compose/.env; echo "wrote deploy/compose/.env"; }
	cd deploy/compose && docker compose up -d --build
	cd deploy/compose && docker compose run --rm seed

compose-down: ## Stop the Compose stack (add -v to `docker compose down` to also drop the database)
	cd deploy/compose && docker compose --profile seed down

k3d-up: ## Local Kubernetes cluster (k3s in Docker, Traefik ingress on http://localhost:8080)
	k3d cluster create $(CLUSTER) --port "8080:80@loadbalancer" --wait

k3d-load: ## Copy the locally built images into the cluster (no registry needed)
	k3d image import halo-api:local halo-web:local --cluster $(CLUSTER)

k8s-secrets: ## Create deploy/k8s/secrets.env with random values (once)
	@if [ -f $(K8S)/secrets.env ]; then echo "$(K8S)/secrets.env already exists"; else \
	  pw=$$(openssl rand -hex 16); \
	  printf 'POSTGRES_PASSWORD=%s\nDATABASE_URL=postgresql+asyncpg://halo:%s@postgres:5432/halo\nJWT_SECRET=%s\nOPENAI_API_KEY=\n' \
	    "$$pw" "$$pw" "$$(openssl rand -hex 32)" > $(K8S)/secrets.env; \
	  echo "wrote $(K8S)/secrets.env"; fi

k8s-deploy: ## Apply all manifests and wait until everything is rolled out
	kubectl apply -k $(K8S)
	kubectl -n halo rollout status statefulset/postgres --timeout=180s
	kubectl -n halo rollout status deployment/api --timeout=300s
	kubectl -n halo rollout status deployment/web --timeout=300s

k8s-seed: ## (Re)create the demo workspace with a one-off Job
	kubectl replace --force -f $(K8S)/seed-job.yaml
	kubectl -n halo wait --for=condition=complete job/seed-demo --timeout=180s
	kubectl -n halo logs job/seed-demo

k8s-status:
	kubectl -n halo get pods,svc,ingress,pvc

k3d-down: ## Delete the local cluster (and everything in it)
	k3d cluster delete $(CLUSTER)
