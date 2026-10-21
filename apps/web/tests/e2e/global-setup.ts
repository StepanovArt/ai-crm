import { request, type FullConfig } from "@playwright/test";

/** Restore the deterministic demo workspace before the suite runs. */
export default async function globalSetup(_config: FullConfig) {
  const api = process.env.E2E_API_URL ?? "http://localhost:8000";
  const ctx = await request.newContext({ baseURL: api });
  const login = await ctx.post("/api/v1/auth/login", {
    data: { email: "demo@halo.dev", password: "demo1234" },
  });
  if (!login.ok()) throw new Error(`Demo login failed: ${login.status()}`);
  const reset = await ctx.post("/api/v1/demo/reset");
  if (!reset.ok()) throw new Error(`Demo reset failed: ${reset.status()}`);
  await ctx.dispose();
}
