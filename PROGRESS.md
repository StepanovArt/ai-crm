# Progress

## Current phase
All phases complete — MVP is demo-ready (see the demo script in `README.md`).

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

## Phase 4 — Records UI ✅
- [x] Field descriptors (`lib/records/descriptors.ts`) unify system columns + custom field definitions → tables and detail panels need no code for new fields
- [x] FieldRenderer / FieldEditor / EditableField (popover editors for all 12 field types + stage/lead status/owner)
- [x] Generic DataTable (TanStack Table): server-side sort, sticky header + first column, row selection, column visibility (persisted), skeleton + empty states
- [x] Companies / Contacts / Deals pages: saved view tabs, owner/stage filters, ad-hoc filter chips (URL-driven so the agent can apply filters), debounced search, bulk assign/delete, create dialogs (`C` shortcut)
- [x] Record detail: header + stats, fields panel, timeline (day groups, typed activity rendering, note composer), tasks, related records
- [x] Tasks page: Overdue / Today / Upcoming / Done with optimistic completion + quick add
- [x] Field-change activities store display names (owner names, option labels) instead of ids
- [x] Playwright: create → inline edit → delete company; API-created custom field shows in table + detail; note on timeline; complete task
- Screens: `docs/screens/phase-4/`

## Phase 5 — Pipeline & Today ✅
- [x] Kanban (dnd-kit multi-container sortable + drag overlay), optimistic move with rollback (`applyMove`, unit-tested), column count/total/weighted, owner/value/close-date filters (URL), add deal per stage
- [x] Cards: name, company, value, owner, days-in-stage (amber when stale), AI sparkle when agent-touched; motion layout animations ready for agent `move_card`
- [x] Today: greeting, AI briefing slot (placeholder until Phase 7), stat tiles, "Who to contact next" (score + reason chips + open deal), my due tasks, open value by stage, going-stale list
- [x] Settings: custom fields (add/edit options/colours/reorder/delete), pipelines & stages (rename, colour, probability, kind, reorder, add/delete), workspace name + terminology
- [x] Playwright: drag & drop persists + writes activity; settings field → table; terminology → nav; new stage → kanban column
- Screens: `docs/screens/phase-5/`

## Phase 6 — Agent backend ✅
- [x] `agent/events.py`: typed AgentEvent + UIAction unions (exposed via `GET /agent/events/schema` so web types are generated)
- [x] 10 tools (`agent/tools/`), Pydantic args, labels, `mutating` flag, `inverse` + exact `undo` (activity collector + snapshots)
- [x] Orchestrator: drives provider via `asend`, refuses mutations outside approved plans, records `agent_actions`, commits per tool, persists conversations/messages/plans
- [x] Mock provider: ordered intent router (+ page context), scenarios S1–S7 + create-task + fallback, realistic pacing (1–4 word tokens, 25–45 ms, 300–700 ms thinking, 150–300 ms between ui_actions; highlights wait for their duration)
- [x] Endpoints: chat (SSE), plans approve (SSE) / reject, actions/undo (returns ui_actions e.g. slide card back), conversations list/detail, insights, briefing (JSON + SSE stream)
- [x] Deterministic insights (summary, bullets, next step) and email drafts from real timeline data
- [x] Tests: each scenario's event sequence + DB effects; S2/S3 undo restores tasks/activities/deals/scores exactly; mutation guard; isolation; insights/briefing (98 API tests total)

## Phase 7 — Agent frontend ✅
- [x] `lib/agent/types.ts` (aliases of generated OpenAPI schemas incl. card payloads), fetch+ReadableStream SSE client with abort/early retry, pure event reducer (unit-tested), zustand agent store (send/approve/reject/undo/stop/history)
- [x] AgentPanel (⌘J, resizable, pushes content on wide screens, overlays < 1100px), thinking shimmer, ToolChips (spinner → check), PlanCard (approve/reject + status), cards (records, chart, email draft with Copy/Save as note, next step with one-click Create task), Undo, page-aware suggested prompts, conversation history
- [x] Sequential ui_action executor (navigate, highlight with live-tracked ring, pulse, move_card via board cache + motion layout, apply_filter via URL, invalidate, toast) + AgentCursor overlay (springs, respects reduced motion)
- [x] ⌘K CommandBar: Ask AI, suggested prompts, record search, navigation, create actions, theme
- [x] InlineInsight on record pages; streamed AI briefing on Today; agent badges on agent-touched deals/tasks/activities
- [x] Streaming-safe markdown (no flashing asterisks), container-query layouts so pages stay tidy with the panel open
- [x] Playwright: S2 plan → approve → tasks → undo; S3 card moves columns → undo; ⌘K Ask AI chart; insight → draft → save note
- Screens: `docs/screens/phase-7/`

## Phase 8 — Onboarding & universality ✅
- [x] 5 industry templates (`b2b_saas`, `real_estate`, `industrial_equipment`, `agency_services`, `recruitment`): terminology, 7-stage pipeline with probabilities, 4–6 custom fields per object, curated names/titles/emails/meetings/notes/tasks; seed builder supports households (no domains), personal email domains and unit numbers
- [x] `onboarding/generator.py`: word-boundary keyword matching (phrases weigh more, earliest match breaks ties, default `b2b_saas`) and a streamed, single-transaction build (thinking → template + step outline → each step running/done with preview data → done)
- [x] `POST /onboarding/generate` (SSE), `POST /onboarding/demo` (skip → instant build), `GET /onboarding/templates`; 409 once onboarded; row lock against concurrent runs; teammates get per-workspace emails and unusable passwords
- [x] `/onboarding`: one-sentence prompt + 5 example chips + "Skip, use demo workspace"; split screen with steps checking off and a live app skeleton (sidebar relabels to the new vocabulary with counts, kanban columns drop in one by one, sample deals and custom fields fill in) → Today
- [x] Tests: template matching + completeness, real-estate DoD (stages, fields, terminology, 30/60/25 records, hot leads, tasks), skip path, two workspaces don't collide (114 API tests); reducer unit tests; Playwright signup → apartments → Today/pipeline and skip path
- [x] Optional: `LLM_PROVIDER=openai` — OpenAI-compatible provider (streaming function calling; mutations only via approved plans; same cards and undo), tested with a fake server
- Screens: `docs/screens/phase-8/`

## Phase 9 — Polish & demo readiness ✅
- [x] Visual pass on every screen in light and dark: long names (two-line titles, clamped cards), zero/one/many and empty states, pipeline subtitle spacing, one-line option previews; insights never call closed deals "overdue"
- [x] Shortcuts: `⌘K`, `⌘J`, `C`, `G` sequences, and a `?` help dialog (also in ⌘K); agent messages sent while a run is still animating are queued instead of dropped
- [x] Performance: indexed "last activity" queries (500 contacts 6 s → ~50 ms, companies 10 s → ~30 ms); query-count regression tests for every list endpoint; tables render progressively with memoized rows (first row 2.5 s → 0.6 s for 500 rows, 60 fps scroll); editor popovers mount only while editing
- [x] Accessibility: axe WCAG 2.1 A/AA audit in e2e for every main screen, AI panel, ⌘K and onboarding (light + dark) — zero violations; AA contrast tokens; no nested interactive controls
- [x] Agent tool chips use the workspace vocabulary ("Searching opportunities…")
- [x] README: screenshots, quickstart, architecture + sequence diagrams, demo script, plugging in a real LLM
- [x] Fresh clone → `make setup` → `make seed` (twice, idempotent) → `make dev` → full demo script (`apps/web/scripts/demo-run.mjs`) passes with no browser errors; `make check` (126 pytest, 26 Vitest, ruff, mypy, ESLint, tsc) and `make e2e` (28 Playwright tests) green
- Screens: `docs/screens/phase-9/`

## After the MVP — containers & Kubernetes ✅
- [x] Dockerfiles for api and web (multi-stage, non-root, same-origin API URL), `.dockerignore`s
- [x] `deploy/compose`: db → migrate → api → web → nginx; full demo script passes through the proxy; SSE unbuffered
- [x] `deploy/k8s` (Kustomize): Namespace, ConfigMap, Secret, Postgres StatefulSet + PVC, api/web Deployments (init-container migrations, probes, preStop, hardened security context), Services, Ingress, seed Job
- [x] Verified on k3s v1.31: full demo script through the ingress; 0/5,912 failed requests during rolling restarts; data survives deleting the database pod; deleted pods are replaced
- [x] App changes: readiness endpoint, prod JWT-secret guard, migration advisory lock (129 API tests)
- Guide: `docs/deploy.md`

## Known limitations
- The mock agent understands the demo intents (Section 12 plus a few more); anything else gets a helpful fallback. Use `LLM_PROVIDER=openai` for open-ended conversation.
- No real email sending, calendar sync or enrichment (out of scope for the MVP).
- Tables render up to 500 rows per page without virtualization.
