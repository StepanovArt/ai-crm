import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const PAGES = ["/today", "/pipeline", "/deals", "/companies", "/contacts", "/tasks", "/settings"];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Agent cursor / toasts are decorative overlays.
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    count: v.nodes.length,
  }));
}

for (const path of PAGES) {
  test(`a11y: ${path} has no WCAG A/AA violations`, async ({ authedPage: page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const violations = await audit(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

test("a11y: a record page has no WCAG A/AA violations", async ({ authedPage: page, api }) => {
  const res = await api.get("http://localhost:8000/api/v1/deals?limit=1");
  const id = (await res.json()).items[0].id as string;
  await page.goto(`/records/deal/${id}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const violations = await audit(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test("a11y: login page has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const violations = await audit(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test("a11y: AI panel and command bar have no WCAG A/AA violations", async ({
  authedPage: page,
}) => {
  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+j");
  await expect(page.locator('[data-agent-id="agent-panel"]')).toBeVisible();
  await page.waitForTimeout(600);
  expect(await audit(page)).toEqual([]);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Search or ask AI" })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test("a11y: onboarding has no WCAG A/AA violations", async ({ page }) => {
  const res = await page.request.post("http://localhost:8000/api/v1/auth/signup", {
    data: { email: `a11y-${Date.now()}@example.org`, password: "password123", full_name: "Ari" },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Describe your business in one sentence" }),
  ).toBeVisible();
  expect(await audit(page)).toEqual([]);
});
