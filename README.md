# Halo CRM

An AI-native B2B CRM where an agent works *alongside* you inside the interface: it plans,
asks for confirmation, visibly acts (navigates, highlights, moves cards, creates tasks), and
every action can be undone.

> Status: under active development — see [`PROGRESS.md`](PROGRESS.md).

## Quickstart

Requirements: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22 + pnpm, Docker (for Postgres).

```bash
make setup   # install deps, create .env files
make up      # start Postgres 16 in Docker
make seed    # migrate + load the demo workspace
make dev     # api on :8000, web on :3000
```

Open http://localhost:3000 and sign in with `demo@halo.dev` / `demo1234`.

## Commands

| Command | What it does |
|---|---|
| `make setup` | install api (uv) and web (pnpm) deps, copy `.env` |
| `make up` | start Postgres via docker compose |
| `make migrate` | apply Alembic migrations |
| `make seed` | load deterministic demo data (idempotent) |
| `make dev` | run api (uvicorn --reload :8000) and web (next dev :3000) |
| `make types` | regenerate the typed web API client from OpenAPI |
| `make lint` / `typecheck` / `test` / `check` | quality gates |
| `make e2e` | Playwright smoke tests (needs `make dev` running) |
