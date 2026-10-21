# Decisions log

One line per decision: what and why.

- 2026-10-21 — Local dev without Docker uses the system Postgres 16 (role/db `halo`, plus `halo_test`); `docker-compose.yml` remains the documented path. Container here has no Docker daemon.
- 2026-10-21 — Pinned to versions I can vouch for instead of bleeding-edge majors: Next 15.5, React 19.2, TS 5.9, TanStack Table 8, ESLint 9, Vitest 3, zod 3.25, motion 12, lucide 0.577. Spec says Next 15; newer majors (TS 7, Table 9) add risk without value.
- 2026-10-21 — `@playwright/test` pinned to 1.56.1 because the preinstalled Chromium is revision 1194.
- 2026-10-21 — Fonts via `@fontsource-variable/inter` / `jetbrains-mono` instead of `next/font/google` so builds work offline.
- 2026-10-21 — shadcn registry is unreachable from this environment; shadcn/ui primitives are written by hand (same source shape, `radix-ui` unified package) and `components.json` kept for future `shadcn add`.
- 2026-10-21 — Web calls the API directly at `NEXT_PUBLIC_API_URL` with `credentials: "include"`; CORS allows the web origin. localhost:3000 and :8000 are same-site, so the SameSite=Lax httpOnly cookie works and SSE is not buffered by a proxy.
- 2026-10-21 — `make types` exports OpenAPI from the app object (`python -m app.openapi_export`) so it does not need a running server.
- 2026-10-21 — Added columns beyond Section 5 where the UI needs them: `deals.stage_entered_at` (days-in-stage), `tasks.completed_at`, `notes.created_by` (agent badge on notes).
- 2026-10-21 — Interactions (emails/calls/meetings) are logged against the *contact* with `payload.deal_id` when they concern a deal; stage changes/notes go on the deal. Timelines union related records (contact ← its deals; deal ← activities tagged with it; company ← its contacts and deals).
- 2026-10-21 — `deals.stage_id` FK uses NO ACTION (not RESTRICT) so deleting a workspace cascades cleanly; the stage service refuses to delete a stage that still has deals.
- 2026-10-21 — Session dependency uses `Depends(..., scope="function")` so the commit lands before the response is sent (FastAPI's default runs yield-teardown after sending).
- 2026-10-21 — Scoring windows: replied = email_received ≤14d; meeting = meeting ≤14d ago or scheduled in the future; opened_multiple = email_sent ≤30d with opens ≥2; stale = no interaction ≤14d. Max achievable score is 90 by design (sum of positive weights).
- 2026-10-21 — Seed uses a seeded `random.Random` for ids too (uuid from rng bits), and fixed uuid5 ids for the demo user/workspace, so `make seed`/`POST /demo/reset` are idempotent and existing sessions survive a reset. Dates are relative to "now".
- 2026-10-21 — The demo workspace gets 3 teammates (Maya, Jonas, Priya @halo.dev, same password) so owners/avatars/filters look real.
- 2026-10-21 — Industry templates are Python dataclasses (`onboarding/templates/*.py`) with curated company names per industry instead of Faker company names (Faker's read as fake).
- 2026-10-21 — Tests run against `halo_test`: the schema is rebuilt with `alembic upgrade head` at session start (validates migrations), the demo seed is loaded once, and each test runs in an outer transaction rolled back at the end (`join_transaction_mode="create_savepoint"`).
- 2026-10-21 — List pagination uses an opaque offset cursor (`next_cursor` = next offset); simple, works with any sort, and lists are small (≤ 500 per page).
- 2026-10-21 — `filter` is validated by a per-object Pydantic model with `extra="forbid"`; custom-field filters use JSONB containment (`custom @> {...}`), which handles selects and multi-selects alike.
- 2026-10-21 — Deal moves take a target `index` in the column; the server computes a float position between neighbours, so clients and the agent never compute positions.
- 2026-10-21 — Added `GET /pipelines/{id}/board` (stages + totals + deals in one call) for the kanban; `/deals` list remains for tables.
- 2026-10-21 — Response models set `json_schema_serialization_defaults_required` so generated TS types mark always-present fields as required; money uses a `Money` type that always serializes as a 2-decimal string.
- 2026-10-21 — Table/record UI is driven by "field descriptors": system columns are declared once per object in `lib/records/descriptors.ts` and custom fields are appended from `/fields`, so FieldRenderer/FieldEditor are shared by tables and detail panels.
- 2026-10-21 — Table view state (view tab, search, sort, ad-hoc filter) lives in the URL. Saved views are code-defined presets (All/Mine/Hot/Stale…) rather than persisted server objects — enough for the MVP and lets the agent's `apply_filter`/`navigate` drive tables.
- 2026-10-21 — Inline edits open a small popover editor anchored to the cell (Attio-style) instead of swapping the cell for an input, to avoid row height jumps; clicking the name cell opens the record.
- 2026-10-21 — openapi-typescript runs with `--default-non-nullable false` so request fields with server defaults stay optional in TS.
- 2026-10-21 — No row virtualization yet; tables render up to 500 rows per page. Revisit in Phase 9 if 500-row scrolling isn't smooth.
- 2026-10-21 — Kanban cards have two layers: an outer `motion.div` (layout/layoutId for animated cross-column moves) and an inner dnd-kit sortable node; layout animation is disabled while dragging and for 250 ms after drop so the two systems never fight.
- 2026-10-21 — Today's "Due today" shows the signed-in user's tasks; the contact queue is workspace-wide (top 8 by score).
- 2026-10-21 — Today's stage chart is a single-series HTML bar list (one hue, value at the tip, tooltip) rather than recharts — better typography for 5–7 bars; recharts is used for the agent's chart card.
- 2026-10-21 — Playwright global setup resets the demo workspace (`POST /demo/reset`) so e2e runs are deterministic; tests clean up the fields/stages they add.
