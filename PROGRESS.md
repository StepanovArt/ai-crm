# Progress

## Current phase
Phase 4 — Records UI

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

## Phase 2 — Core API ✅
- [x] Companies / contacts / deals / tasks / notes CRUD + list (`q`, `limit`, `cursor`, `sort` incl. `custom.<key>`, JSON `filter`)
- [x] Enriched outputs without N+1 (bulk lookups: company/contact briefs, stage, last activity, open deal totals, agent-touched)
- [x] Activities timeline per record (unions linked records), notes keep their timeline entry in sync
- [x] Pipelines + stages CRUD/reorder, board endpoint with per-stage count/total/weighted value, `PATCH /deals/{id}/move` with index-based positioning
- [x] Fields CRUD + reorder (deleting a field strips its values), `GET /contacts/{id}/score`, `GET /dashboard/today`
- [x] `make types` → `apps/web/src/lib/api/schema.d.ts`; openapi-fetch client in `src/lib/api/client.ts`
- [x] 74 pytest tests (happy + error path per router, HTTP-level isolation)

## Phase 3 — App shell & design system ✅
- [x] Tokens (light/dark), hand-written shadcn primitives (button, input, dialog, dropdown, popover, select, tabs, command, checkbox, switch, tooltip, badge, card, skeleton, kbd)
- [x] Sidebar (collapsible, terminology-aware labels, overdue badge, workspace switcher with theme / reset demo / sign out), Topbar (breadcrumbs, ⌘K trigger, Ask AI, avatar)
- [x] Auth pages (login with "Explore the demo workspace", signup), middleware + client-side auth gate, onboarding redirect
- [x] Shared: PageHeader, EmptyState, Skeleton, Avatar/CompanyLogo, StatusBadge/LeadStatusBadge, ScoreBadge (lazy breakdown tooltip), MoneyText, RelativeDate, AgentBadge
- [x] `data-agent-id` helpers (`lib/agent-ids.ts`), query key factory (`lib/query-keys.ts`), global shortcuts (⌘K, ⌘J, G-sequences)
- [x] Playwright: login redirect + sign-in + nav; wrong password
- Screens: `docs/screens/phase-3/`

## Next
- Phase 4: DataTable + FieldRenderer/FieldEditor, companies/contacts/deals tables, record detail, tasks page

## Known issues
- none
