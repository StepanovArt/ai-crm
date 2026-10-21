# CLAUDE.md — Halo CRM (AI-native B2B CRM)

> You are the sole engineer building this project from an empty repo to a polished MVP.
> Read this whole file before writing any code. Re-read the relevant phase before starting it.
> "Halo CRM" is a working name. Keep it in one config constant (`APP_NAME`) so it can be renamed.

---

## 0. How you work (read first)

1. **Work phase by phase** (Section 10). Never start a phase before the previous one meets its Definition of Done.
2. **Keep `PROGRESS.md`** at the repo root. At the start of each session, read it. After each meaningful step, update it: current phase, done items, next item, known issues.
3. **Keep `DECISIONS.md`**. When something is ambiguous, do not stop to ask. Make the most reasonable decision, write one line on what and why, continue.
4. **Verify before claiming done.** Every phase ends with: lint, typecheck, tests, and running the app. For UI work, open the page (Playwright screenshot or browser) and look at it. "It compiles" is not done.
5. **Commit small and often** with conventional messages (`feat(api): ...`, `fix(web): ...`). One commit per logical unit. Never leave the repo broken at the end of a session.
6. **Do not add dependencies outside Section 3** unless clearly necessary. If you add one, log it in `DECISIONS.md`.
7. **Quality bar is visual.** This is a demo product judged on how it looks and feels. Five perfect screens beat fifteen average ones. Empty states, loading states, and animations are part of the feature, not extras.
8. **LLM is mocked.** Only the *reasoning* is fake. Tools the agent calls perform **real** database operations. The demo must actually change data.

---

## 1. Product

### 1.1 One-liner
A universal B2B CRM where an AI agent works *alongside* the user inside the interface: it plans, asks for confirmation, then visibly acts (navigates, highlights, moves cards, creates tasks), and every action can be undone.

### 1.2 Two core ideas
1. **Universal through AI setup, not settings screens.** The user describes their business in one sentence; the AI generates the workspace (pipeline stages, custom fields, terminology, sample data) and the UI assembles itself on screen.
2. **An agent that acts in the UI, not just a chatbot.** It sees page context, proposes a plan, executes with a visible "agent cursor", and offers undo.

### 1.3 Reference products (for look & feel)
Linear (speed, keyboard-first), Attio (flexible data model, dense tables), Leadey.ai (sales-focused CRM with AI assistant, work queue ranked by intent, pipeline kanban).

### 1.4 Out of scope for MVP
Real email/SMS/WhatsApp sending, telephony/dialer, external lead databases, real enrichment, billing, mobile app, multi-language UI. Do not build these. Leave clean extension points only where noted.

### 1.5 UI language
English.

---

## 2. Architecture overview

```
apps/web (Next.js) ──REST + SSE──► apps/api (FastAPI) ──► PostgreSQL
                                        │
                                        ├─ services/ (business logic)
                                        ├─ agent/   (orchestrator, tools, providers)
                                        │     └─ providers/mock.py  ← active
                                        └─ seed/    (deterministic demo data)
```

- Monorepo, two apps, one `docker-compose.yml` for Postgres.
- Backend is the source of truth. Frontend never fakes data or agent replies.
- Agent communicates via **typed SSE events** (Section 6). The frontend renders events; it contains no scenario logic.

---

## 3. Tech stack (fixed)

### Backend — `apps/api`
- Python 3.12, **uv** for env and deps
- **FastAPI**, **Pydantic v2**, **pydantic-settings**
- **SQLAlchemy 2.0** (async, `asyncpg`), **Alembic**
- **PostgreSQL 16** (JSONB for custom fields)
- Auth: email + password, `argon2` hashing, JWT in httpOnly cookie
- SSE: `sse-starlette`
- Tests: **pytest**, `pytest-asyncio`, `httpx` AsyncClient
- Lint/format: **ruff**; types: **mypy** (strict on `agent/` and `services/`)
- Seed: **Faker** with fixed seed

### Frontend — `apps/web`
- **Next.js 15** (App Router), **TypeScript strict**, **pnpm**
- **Tailwind CSS v4**, **shadcn/ui**, **lucide-react**
- **TanStack Query** (server state), **Zustand** (agent/UI state)
- **TanStack Table** (data tables), **dnd-kit** (kanban), **cmdk** (command bar)
- **motion** (Framer Motion) for animations and the agent cursor
- **sonner** (toasts), **recharts** (small charts), **react-hook-form + zod** (forms)
- API types generated from OpenAPI with **openapi-typescript** + **openapi-fetch**
- Font: **Inter** (UI), **JetBrains Mono** (numbers/IDs, optional)
- Tests: **Vitest** (units), **Playwright** (e2e smoke)
- Lint: ESLint + Prettier

### Infra
- `docker-compose.yml`: postgres only (api and web run locally in dev)
- `Makefile` at root with the commands in Section 11

---

## 4. Repository layout

```
/
├── CLAUDE.md  PROGRESS.md  DECISIONS.md  README.md  Makefile  docker-compose.yml  .env.example
├── apps/
│   ├── api/
│   │   ├── pyproject.toml  alembic.ini
│   │   ├── alembic/versions/
│   │   ├── app/
│   │   │   ├── main.py              # app factory, routers, CORS
│   │   │   ├── config.py            # Settings (LLM_PROVIDER, DATABASE_URL, JWT_SECRET...)
│   │   │   ├── db.py                # engine, session dependency
│   │   │   ├── deps.py              # current_user, current_workspace
│   │   │   ├── models/              # SQLAlchemy models, one file per aggregate
│   │   │   ├── schemas/             # Pydantic request/response
│   │   │   ├── routers/             # thin HTTP layer only
│   │   │   ├── services/            # business logic (records, deals, tasks, activities, fields)
│   │   │   ├── agent/
│   │   │   │   ├── events.py        # AgentEvent union (Section 6)
│   │   │   │   ├── orchestrator.py  # runs provider, executes tools, persists, streams
│   │   │   │   ├── tools/           # one file per tool, registry in __init__.py
│   │   │   │   ├── providers/
│   │   │   │   │   ├── base.py      # LLMProvider Protocol
│   │   │   │   │   ├── mock.py      # intent router + scenarios (ACTIVE)
│   │   │   │   │   └── openai_compat.py  # optional, Phase 8
│   │   │   │   ├── scenarios/       # one file per mock scenario
│   │   │   │   └── context.py       # PageContext model
│   │   │   ├── onboarding/
│   │   │   │   ├── templates/       # industry templates (YAML or Python dicts)
│   │   │   │   └── generator.py
│   │   │   └── seed/
│   │   └── tests/
│   └── web/
│       ├── package.json
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/  (auth)/signup/
│       │   │   ├── onboarding/
│       │   │   └── (app)/
│       │   │       ├── layout.tsx           # sidebar + topbar + agent panel + cursor overlay
│       │   │       ├── today/               # dashboard
│       │   │       ├── pipeline/[pipelineId]/
│       │   │       ├── companies/  contacts/  deals/
│       │   │       ├── records/[type]/[id]/ # record detail
│       │   │       ├── tasks/
│       │   │       └── settings/            # fields, pipelines, workspace
│       │   ├── components/
│       │   │   ├── ui/              # shadcn primitives
│       │   │   ├── layout/          # Sidebar, Topbar
│       │   │   ├── records/         # DataTable, FieldRenderer, FieldEditor
│       │   │   ├── pipeline/        # Kanban, DealCard
│       │   │   ├── timeline/
│       │   │   └── agent/           # AgentPanel, AgentMessage, PlanCard, ToolCallChip,
│       │   │                        # AgentCursor, CommandBar, InlineInsight
│       │   ├── lib/
│       │   │   ├── api/             # generated types + client
│       │   │   ├── agent/           # SSE client, event reducer, ui_action executor
│       │   │   └── utils.ts
│       │   └── stores/              # zustand: agent store, ui store
│       └── tests/e2e/
```

---

## 5. Data model

All tables have `id UUID PK`, `created_at`, `updated_at`. Every business table has `workspace_id` FK and **every query filters by it** (enforce in a service-layer helper; add a test that a user cannot read another workspace's data).

### Identity
- `users(email unique, password_hash, full_name, avatar_url)`
- `workspaces(name, industry, terminology JSONB, onboarding_completed bool)`
  - `terminology` example: `{"deal": "Project", "deals": "Projects", "company": "Client"}`. The UI must read labels from here.
- `memberships(user_id, workspace_id, role: owner|member)`

### Flexible schema
- `field_definitions(workspace_id, object_type: company|contact|deal, key, label, type, options JSONB, position, is_required, is_system)`
  - `type`: `text | long_text | number | currency | date | select | multi_select | email | phone | url | user | checkbox`
  - `options` for select: `[{"value":"hot","label":"Hot","color":"red"}]`
- Records store custom values in `custom JSONB` keyed by `field_definitions.key`. Validate values against the definition in `services/fields.py`.

### Records
- `companies(workspace_id, name, domain, industry, size, logo_url, owner_id, custom JSONB)`
- `contacts(workspace_id, company_id NULL, first_name, last_name, email, phone, title, owner_id, lead_status, score int, custom JSONB)`
- `pipelines(workspace_id, name, position)`
- `stages(pipeline_id, name, position, color, probability int, kind: open|won|lost)`
- `deals(workspace_id, pipeline_id, stage_id, name, value numeric, currency, company_id, primary_contact_id, owner_id, expected_close date, position float, custom JSONB, last_activity_at)`

### Work
- `tasks(workspace_id, title, due_at, done bool, assignee_id, related_type, related_id, created_by: user|agent)`
- `notes(workspace_id, related_type, related_id, body, author_id)`
- `activities(workspace_id, type, actor_type: user|agent|system, actor_id, related_type, related_id, payload JSONB, occurred_at)`
  - `type`: `email_sent | email_received | call | meeting | note | stage_changed | field_updated | task_created | task_completed | record_created`
  - **Every mutation writes an activity.** Timeline, "last activity", and agent context all derive from this table.

### Agent
- `agent_conversations(workspace_id, user_id, title)`
- `agent_messages(conversation_id, role: user|assistant, content, events JSONB)`
- `agent_plans(conversation_id, steps JSONB, status: proposed|approved|rejected|executed)`
- `agent_actions(workspace_id, conversation_id, plan_id NULL, tool, args JSONB, result JSONB, inverse JSONB, undone bool)`
  - `inverse` describes how to revert (e.g. previous stage_id, ids of created tasks). Undo must work for every mutating tool.

### Scoring (simple, explainable)
`contacts.score` 0–100 is computed in `services/scoring.py` as a weighted sum of signals, and the breakdown is returned by the API:

```
score = clamp(Σ w_k · x_k, 0, 100)
signals: replied_recently(30), meeting_scheduled(25), opened_multiple(10),
         deal_open(15), title_is_decision_maker(10), stale_14d(-20)
```

The UI shows the score and, on hover, the contributing signals. Recompute on relevant activity.

---

## 6. Agent design (the flagship feature)

### 6.1 Behaviour contract
1. User sends a message (from the panel or `⌘K`). The request includes **PageContext**: `{route, record_type?, record_id?, pipeline_id?, selected_ids?, visible_filters?}`.
2. Read-only requests (questions, summaries, stats) → the agent answers directly, may call read tools.
3. Mutating requests → the agent **must emit a `plan` first** and stop. The user approves → execution streams `tool_call` / `ui_action` / `tool_result` → final message with **Undo**.
4. Every mutation is recorded in `agent_actions` with an inverse.

### 6.2 SSE event protocol (`app/agent/events.py`, mirrored in `web/src/lib/agent/types.ts`)

```ts
type AgentEvent =
  | { type: "message_start"; message_id: string }
  | { type: "token"; text: string }
  | { type: "thinking"; label: string }                 // short status, e.g. "Looking at your pipeline"
  | { type: "plan"; plan_id: string; title: string;
      steps: { id: string; label: string; tool: string }[] }
  | { type: "tool_call"; call_id: string; tool: string; label: string; args: object }
  | { type: "tool_result"; call_id: string; ok: boolean; summary: string; data?: object }
  | { type: "ui_action"; action: UIAction }
  | { type: "card"; kind: "records" | "chart" | "email_draft" | "stats"; data: object }
  | { type: "message_end"; message_id: string; undo_action_ids?: string[] }
  | { type: "error"; message: string };

type UIAction =
  | { kind: "navigate"; href: string }
  | { kind: "highlight"; target: string; duration_ms?: number }   // target = data-agent-id
  | { kind: "pulse"; target: string }
  | { kind: "move_card"; deal_id: string; to_stage_id: string }
  | { kind: "open_record"; record_type: string; record_id: string }
  | { kind: "apply_filter"; view: string; filter: object }
  | { kind: "invalidate"; query_keys: string[][] }                 // refetch TanStack Query caches
  | { kind: "toast"; text: string };
```

### 6.3 Endpoints
- `POST /agent/chat` (SSE) body `{conversation_id?, message, context}`
- `POST /agent/plans/{plan_id}/approve` (SSE) streams execution
- `POST /agent/plans/{plan_id}/reject`
- `POST /agent/actions/undo` body `{action_ids}`
- `GET /agent/conversations`, `GET /agent/conversations/{id}`
- `GET /agent/insights?record_type&record_id` → inline insight (summary + next step) for record pages
- `GET /agent/briefing` → structured daily briefing for the Today page

### 6.4 Tools (`app/agent/tools/`)
Each tool: Pydantic args model, `label` for UI, `mutating: bool`, `run(ctx, args) -> ToolResult`, and for mutating tools `inverse(result) -> dict`. Tools call `services/`, never the DB directly.

| Tool | Mutating | Purpose |
|---|---|---|
| `search_records` | no | filter companies/contacts/deals (stage, owner, value range, stale_days, score) |
| `get_record` | no | full record + recent activities |
| `pipeline_stats` | no | totals by stage, weighted value, won this month |
| `summarize_record` | no | timeline summary + suggested next step |
| `draft_email` | no | returns subject/body draft (shown as `card`) |
| `create_task` | yes | one or many tasks |
| `update_record` | yes | set fields (incl. custom) |
| `move_deal_stage` | yes | change stage + activity |
| `add_note` | yes | note on a record |
| `navigate` | no | emits only a `ui_action` |

### 6.5 Provider abstraction
```python
class LLMProvider(Protocol):
    async def run(self, conv: ConversationState, ctx: PageContext,
                  tools: ToolRegistry) -> AsyncIterator[ProviderStep]: ...
```
`ProviderStep` is either text tokens, a request to call a tool, a plan proposal, a ui_action, or a card. The **orchestrator** executes tool calls, persists everything, converts steps into `AgentEvent`s. Selected by `LLM_PROVIDER=mock|openai` in settings.

### 6.6 Mock provider (must feel real)
- **Intent router**: lowercase message → ordered regex/keyword rules → scenario. Use PageContext (e.g. "summarize this" on a record page targets that record).
- **Scenarios query real data** through read tools, then compose replies from templates filled with actual names, numbers and dates. Never hardcode record names.
- **Streaming realism**: tokens of 1–4 words, 25–45 ms jitter between tokens, 300–700 ms `thinking` before tool calls, 150–300 ms between ui_actions.
- **Fallback**: unknown intent → helpful reply listing 4 example prompts as clickable suggestions.

Required scenarios (each has a pytest that runs it against seed data and asserts events + DB changes):

| # | Example prompt | Flow |
|---|---|---|
| S1 | "What's on my plate today?" | read tasks, hot leads, stale deals → briefing text + `records` card |
| S2 | "Find stale deals and create follow-ups" | search stale>7d → **plan** → approve → navigate to pipeline, highlight each deal, create tasks, invalidate, toast, undo |
| S3 | "Move Acme to Negotiation" (fuzzy name match) | **plan** → approve → `move_card` animation → activity → undo |
| S4 | "Draft a follow-up email to {contact}" / on record page "draft email" | get_record → `email_draft` card with Copy / Save as note |
| S5 | "How's the pipeline this month?" | pipeline_stats → text + `chart` card |
| S6 | On record page: "Summarize this" | summarize_record → bullets + next step + one-click "Create task" |
| S7 | "Show me hot leads" | apply_filter on contacts view with score ≥ 70, navigate, highlight top 3 |

### 6.7 Frontend agent pieces
- **AgentPanel**: right-side, resizable, toggled with `⌘J`. Renders messages, `thinking` shimmer, ToolCallChips (spinner → check), PlanCard (Approve / Edit-free reject), result cards, Undo button. Suggested prompts when empty, adapted to current page.
- **CommandBar** (`⌘K`): navigation + record search + "Ask AI: …" which sends to the agent and opens the panel.
- **AgentCursor**: a global overlay. On `highlight`, find `[data-agent-id="..."]`, animate a small branded cursor + glow ring to its bounding box (motion spring), scroll into view if needed. All agent-targetable elements must have stable `data-agent-id` (e.g. `deal-card-{id}`, `nav-pipeline`, `stage-column-{id}`).
- **ui_action executor** (`lib/agent/executor.ts`): sequential queue; awaits each animation before the next so actions are watchable.
- **InlineInsight**: on record pages, a card with AI summary + next step from `/agent/insights`.
- Agent identity: distinct gradient (violet → cyan) used only for agent UI, so users always know what the AI did. Agent-created tasks/activities show a small sparkle badge.

---

## 7. Onboarding (universality wow moment)

Flow: sign up → "Describe your business in one sentence" (+ 5 example chips) → stream generation → land on Today with data.

- `onboarding/templates/`: at least **5 industry templates**: `b2b_saas`, `real_estate`, `industrial_equipment`, `agency_services`, `recruitment`. Each defines terminology, 1 pipeline with 5–7 stages (with probabilities), 4–8 custom fields per object, seed flavour (company name patterns, deal value ranges, titles).
- `generator.py` (mock): keyword match → template (default `b2b_saas`). Streams events: `thinking` → `step` items ("Creating pipeline: Lead → Viewing → Offer → …", "Adding fields: Budget, Property type…", "Generating 30 sample companies") → done.
- Frontend shows a split screen: left the steps checking off, right a **live skeleton of the app** that fills in as steps complete (sidebar labels change to the terminology, kanban columns appear one by one).
- Also offer "Skip, use demo workspace".

---

## 8. Design system

### Principles
Calm, dense, fast. Lots of whitespace in layout, density inside tables. One accent colour. Keyboard first. Every async action has a loading state; every list has an empty state with an illustration-free icon + one-line hint + primary action.

### Tokens (CSS variables, light + dark)
- Neutral scale: zinc. Background `#FAFAFA` / dark `#09090B`; surface `#FFFFFF` / `#111113`; border `zinc-200` / `zinc-800`.
- Accent (product): indigo-600 `#4F46E5` (dark: indigo-400).
- Agent gradient: `linear-gradient(135deg, #8B5CF6, #06B6D4)`. Reserved for agent UI only.
- Semantic: success emerald-500, warning amber-500, danger rose-500.
- Stage colours: user-selectable from 8 muted presets.
- Radius: 8px controls, 12px cards, 16px panels. Spacing on 4px grid.
- Type: Inter; 13px base in tables, 14px body, 20/24/30 headings, tabular numbers for money.
- Shadows: almost none; use borders. Elevated popovers: soft shadow.
- Motion: 150–250 ms ease-out for UI; springs for cursor and card moves. Respect `prefers-reduced-motion`.

### Layout
- Left sidebar (collapsible, 240px): workspace switcher, Today, Pipeline, Deals, Companies, Contacts, Tasks, Settings. Labels use workspace terminology.
- Topbar: breadcrumb, search trigger (`⌘K`), "Ask AI" button with agent gradient, avatar.
- Right: AgentPanel (360–480px), pushes content rather than overlaying on wide screens.

### Screens (MVP)
1. **Today** — greeting + AI briefing card (streamed), "Who to contact next" queue ranked by score with reason chips, tasks due, pipeline mini-stats, stale deals.
2. **Pipeline** — kanban, column header shows count + total + weighted value, drag & drop with optimistic update, deal card: name, company logo/initials, value, owner avatar, days-in-stage, AI sparkle if recently touched by agent. Filters: owner, value, close date.
3. **Tables** (Companies / Contacts / Deals) — TanStack Table, sortable, column visibility, inline edit of fields, filter bar, saved view tabs, bulk select.
4. **Record detail** — header with key fields, left column all fields (editable via FieldRenderer/FieldEditor), centre timeline (activities, notes, composer), right InlineInsight + related records + tasks.
5. **Tasks** — grouped Overdue / Today / Upcoming / Done.
6. **Settings** — custom fields editor (add/reorder/edit options), pipelines & stages editor, terminology, workspace name.
7. **Auth + Onboarding**.

---

## 9. API conventions

- REST under `/api/v1`. Plural nouns. `GET list` supports `?q=&limit=&cursor=&sort=&filter=` (filter as JSON string).
- Errors: `{"error": {"code": "not_found", "message": "..."}}` with proper status codes.
- Responses are Pydantic models; every router has `response_model`.
- Money as decimal strings in JSON.
- After API changes run `make types` to regenerate the web client. Never hand-write API types on the frontend.
- Endpoints (minimum): auth (signup, login, logout, me), workspaces (current, update), fields CRUD, pipelines + stages CRUD/reorder, companies/contacts/deals CRUD + list, `PATCH /deals/{id}/move`, tasks CRUD, notes CRUD, activities list per record, `GET /dashboard/today`, `GET /contacts/{id}/score`, onboarding (`POST /onboarding/generate` SSE), agent (Section 6.3), `POST /demo/reset` (dev only).

---

## 10. Development pipeline (phases)

Each phase lists deliverables and a **Definition of Done (DoD)**. Update `PROGRESS.md` at the end of each phase with a short checklist and screenshots paths (save screenshots in `docs/screens/phase-N/`).

### Phase 0 — Scaffold (target: 0.5 day)
- Monorepo layout, `docker-compose.yml` (Postgres), `.env.example`, `Makefile`, `README.md` quickstart.
- FastAPI app with `/api/v1/health`, settings, DB session, Alembic initialised.
- Next.js app with Tailwind, shadcn/ui initialised, Inter font, light/dark theme toggle, base layout shell (empty sidebar/topbar).
- Ruff, mypy, ESLint, Prettier, pytest, Vitest, Playwright configured.
- **DoD:** `make up && make dev` runs both apps; `make check` passes; web shows the shell; health endpoint returns 200.

### Phase 1 — Data model, auth, seed (1–1.5 days)
- All models from Section 5 + migrations. Workspace scoping helper + isolation test.
- Auth (signup/login/logout/me), JWT cookie, `current_user` / `current_workspace` deps.
- Field validation service. Activity writer used by all services.
- Deterministic seed: one demo user `demo@halo.dev` / `demo1234`, `b2b_saas` workspace with ~30 companies, ~60 contacts, ~25 deals across stages, ~40 tasks, ~200 activities spread over 60 days, some deals stale. `make seed` and `POST /demo/reset`.
- Scoring service + tests.
- **DoD:** migrations apply on a clean DB; seed is idempotent; tests for auth, isolation, field validation, scoring pass.

### Phase 2 — Core API (1–1.5 days)
- CRUD + list/filter/sort/pagination for companies, contacts, deals, tasks, notes. Activities per record. Pipelines/stages CRUD + reorder. Deal move. Fields CRUD. Dashboard endpoint.
- OpenAPI typed client generation wired (`make types`).
- **DoD:** pytest covers each router happy path + one error path; `make types` produces a clean client; OpenAPI docs load.

### Phase 3 — App shell & design system (1 day)
- Design tokens, Sidebar (terminology-aware), Topbar, theme toggle, auth pages, protected routes, TanStack Query provider, toasts.
- Shared components: PageHeader, EmptyState, Skeletons, Avatar, StatusBadge, ScoreBadge (with breakdown tooltip), MoneyText, RelativeDate.
- `data-agent-id` convention set up.
- **DoD:** login with demo user works; navigation between empty pages works; looks polished in both themes (screenshot check).

### Phase 4 — Records UI (2 days)
- Generic DataTable with FieldRenderer/FieldEditor driven by `field_definitions` (custom fields appear automatically).
- Companies, Contacts, Deals tables: search, filters, sort, inline edit, create dialog, bulk select.
- Record detail page: fields panel, timeline with notes composer, related records, tasks.
- Tasks page.
- **DoD:** create/edit/delete works end to end; a new custom field added via API appears in table and detail without code changes; empty and loading states present.

### Phase 5 — Pipeline & Today (1.5 days)
- Kanban with dnd-kit, optimistic move, rollback on error, column totals, filters.
- Today dashboard (without AI briefing yet: placeholder card slot), "Who to contact next" queue using score + reasons.
- Settings: fields editor, pipelines/stages editor, terminology.
- **DoD:** drag & drop persists and writes an activity; Today shows real seed data; settings changes reflect immediately in UI.

### Phase 6 — Agent backend (2 days)
- `events.py`, tool registry with all tools in 6.4, orchestrator, conversation persistence, plans, actions with inverse, undo endpoint.
- Mock provider with intent router and scenarios S1–S7, streaming realism.
- `/agent/insights`, `/agent/briefing`.
- **DoD:** pytest for each scenario asserts event sequence and DB effects; undo restores DB state exactly for S2 and S3; `curl -N` on `/agent/chat` shows a natural-looking stream.

### Phase 7 — Agent frontend (2–2.5 days) ← most important for the demo
- SSE client (fetch + ReadableStream, handles reconnect/abort) and event reducer into the zustand agent store.
- AgentPanel, PlanCard, ToolCallChip, result cards (records, chart, email_draft, stats), Undo.
- ui_action executor + AgentCursor overlay with highlight/pulse/move_card animations.
- CommandBar `⌘K` with "Ask AI".
- Context-aware suggested prompts; PageContext sent with every message.
- InlineInsight on record pages; AI briefing card on Today (streamed).
- Agent badges on agent-created items.
- **DoD:** all 7 scenarios work from the UI and are visually watchable; Playwright e2e covers S2 (plan → approve → tasks created → undo) and S3 (card moves columns); no layout shift or flicker during streaming.

### Phase 8 — Onboarding & universality (1 day)
- 5 industry templates, generator, streaming endpoint, split-screen onboarding with live skeleton, "use demo workspace" path.
- Optional (only if all above is done): `openai_compat.py` provider using the same tool schemas via function calling, toggled by `LLM_PROVIDER=openai`. Must not be required to run the demo.
- **DoD:** signing up as a new user with "We sell apartments in new developments" produces a real-estate workspace with matching stages, fields, terminology and data.

### Phase 9 — Polish & demo readiness (1–1.5 days)
- Visual pass on every screen in light and dark: spacing, alignment, truncation, long names, zero/one/many states.
- Micro-interactions: hover states, focus rings, keyboard shortcuts (`⌘K`, `⌘J`, `C` create, `G then P` pipeline, `?` shortcuts help dialog).
- Performance: tables of 500 rows smooth; no N+1 queries (check SQL logs).
- Accessibility basics: labels, focus order, contrast.
- `README.md`: screenshots, quickstart, architecture diagram, demo script (Section 12), how to plug a real LLM.
- **DoD:** fresh clone → `make setup && make dev` → full demo script runs without errors; `make check` and e2e pass.

---

## 11. Commands (Makefile)

```
make setup     # install api (uv sync) and web (pnpm i) deps, copy .env
make up        # docker compose up -d postgres
make migrate   # alembic upgrade head
make seed      # load demo data (idempotent)
make dev       # run api (uvicorn --reload :8000) and web (next dev :3000) together
make types     # regenerate web/src/lib/api/schema.d.ts from api OpenAPI
make lint      # ruff + eslint
make typecheck # mypy + tsc --noEmit
make test      # pytest + vitest
make e2e       # playwright
make check     # lint + typecheck + test
```

---

## 12. Demo script (the MVP must run this flawlessly)

1. Sign up → describe business "We sell industrial equipment to factories" → watch the workspace assemble.
2. Today page: AI briefing streams in; "Who to contact next" shows ranked leads with reasons.
3. `⌘K` → "Find stale deals and create follow-ups" → plan card → Approve → agent cursor moves across the pipeline highlighting deals → tasks appear → Undo works.
4. Ask "Move {deal} to Negotiation" → card visibly slides to the new column.
5. Open a contact → InlineInsight summary → "Draft a follow-up email" → email card → Save as note → appears in timeline.
6. "How's the pipeline this month?" → chart card.
7. Settings → add a custom field → it appears in the table immediately.

---

## 13. Code rules

- Routers are thin; logic lives in `services/`. Tools call services.
- No business logic in React components; put it in hooks (`useDeals`, `useMoveDeal`) and `lib/`.
- Server state only in TanStack Query; UI/agent state in zustand; no duplicated sources of truth.
- Use query key factories (`qk.deals.list(filters)`); agent `invalidate` actions use the same keys.
- Type everything. No `any` in TS, no untyped dicts crossing service boundaries in Python.
- Small files: components < 200 lines, split otherwise.
- Never commit secrets. `.env` is gitignored.
- Do not mock data in the frontend. If an endpoint is missing, build it.
- Every mutating service writes an activity.
- Every agent mutation is undoable.

## 14. Common pitfalls to avoid

- Building the agent before the CRM screens exist (agent with nothing to act on looks empty).
- Putting scenario text or fake replies in the frontend.
- Hardcoding record names in mock scenarios instead of querying the DB.
- Forgetting `workspace_id` filters.
- ui_actions firing all at once (they must run sequentially and be watchable).
- Optimistic updates without rollback.
- Empty screens because seed data is thin or unrealistic.
- Over-scoping: email sending, dialer, real enrichment are out of scope.
