# Progress

## Current phase
Phase 2 — Core API

## Phase 0 — Scaffold ✅
- [x] Monorepo layout, docker-compose (Postgres 16), `.env.example`, Makefile
- [x] FastAPI app factory, settings, error envelope, `/api/v1/health`, Alembic (async)
- [x] Next.js 15 + Tailwind v4 + design tokens + theme toggle + base shell
- [x] Ruff, mypy, ESLint, Prettier, pytest, Vitest, Playwright configured
- Screens: `docs/screens/phase-0/`

## Phase 1 — Data model, auth, seed ✅
- [x] All Section 5 models + initial Alembic migration
- [x] Workspace scoping helpers (`services/scoping.py`) + isolation tests
- [x] Auth: signup/login/logout/me, argon2, JWT httpOnly cookie; `current_user`/`current_workspace`/`Ctx` deps
- [x] Field validation service (all 12 types) + definition CRUD service
- [x] Activity writer (updates `last_activity_at`, rescoring) used by services
- [x] Scoring service with explainable breakdown + tests
- [x] Deterministic, idempotent seed (`make seed`, `POST /demo/reset`): 30 companies, 60 contacts, 25 deals, 40 tasks, ~280 activities, stale deals, 8 hot leads

## Next
- Phase 2: CRUD/list endpoints for companies, contacts, deals, tasks, notes; activities; pipelines/stages; deal move; fields; dashboard; `make types`

## Known issues
- none
