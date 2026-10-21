import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

type Fixtures = { authedPage: Page; api: APIRequestContext };

/** A page signed in as the demo user (cookie shared with `api`). */
export const test = base.extend<Fixtures>({
  api: async ({ context }, use) => {
    const res = await context.request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: "demo@halo.dev", password: "demo1234" },
    });
    expect(res.ok()).toBeTruthy();
    await use(context.request);
  },
  authedPage: async ({ page, api }, use) => {
    void api;
    await use(page);
  },
});

export { expect };
