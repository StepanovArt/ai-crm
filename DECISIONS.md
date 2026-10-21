# Decisions log

One line per decision: what and why.

- 2026-10-21 — Local dev without Docker uses the system Postgres 16 (role/db `halo`, plus `halo_test`); `docker-compose.yml` remains the documented path. Container here has no Docker daemon.
- 2026-10-21 — Pinned to versions I can vouch for instead of bleeding-edge majors: Next 15.5, React 19.2, TS 5.9, TanStack Table 8, ESLint 9, Vitest 3, zod 3.25, motion 12, lucide 0.577. Spec says Next 15; newer majors (TS 7, Table 9) add risk without value.
- 2026-10-21 — `@playwright/test` pinned to 1.56.1 because the preinstalled Chromium is revision 1194.
- 2026-10-21 — Fonts via `@fontsource-variable/inter` / `jetbrains-mono` instead of `next/font/google` so builds work offline.
- 2026-10-21 — shadcn registry is unreachable from this environment; shadcn/ui primitives are written by hand (same source shape, `radix-ui` unified package) and `components.json` kept for future `shadcn add`.
- 2026-10-21 — Web calls the API directly at `NEXT_PUBLIC_API_URL` with `credentials: "include"`; CORS allows the web origin. localhost:3000 and :8000 are same-site, so the SameSite=Lax httpOnly cookie works and SSE is not buffered by a proxy.
- 2026-10-21 — `make types` exports OpenAPI from the app object (`python -m app.openapi_export`) so it does not need a running server.
