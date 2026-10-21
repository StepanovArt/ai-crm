import type { Page } from "@playwright/test";

import { API_URL, expect, test } from "./fixtures";

test.describe.configure({ mode: "serial" });

async function ask(page: Page, prompt: string) {
  if (!(await page.locator('[data-agent-id="agent-panel"]').isVisible())) {
    await page.locator('[data-agent-id="topbar-ask-ai"]').click();
  }
  const input = page.locator('[data-agent-id="agent-input"]');
  await input.fill(prompt);
  await input.press("Enter");
}

async function agentTasks(api: import("@playwright/test").APIRequestContext) {
  const res = await api.get(`${API_URL}/api/v1/tasks?filter=${encodeURIComponent(JSON.stringify({ created_by: "agent" }))}`);
  return ((await res.json()) as { total: number }).total;
}

test("S2: stale deals → plan → approve → tasks created → undo", async ({ authedPage: page, api }) => {
  test.setTimeout(120_000);
  await api.post(`${API_URL}/api/v1/demo/reset`);
  expect(await agentTasks(api)).toBe(0);
  await page.goto("/today");
  await ask(page, "Find stale deals and create follow-ups");

  const plan = page.locator('[data-plan-status="proposed"]');
  await expect(plan).toBeVisible({ timeout: 30_000 });
  const steps = await plan.locator("li").count();
  expect(steps).toBeGreaterThanOrEqual(3);
  expect(await agentTasks(api)).toBe(0); // nothing changes before approval

  await plan.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/pipeline\//, { timeout: 15_000 });
  // The agent cursor highlights deal cards while it works.
  await expect(page.locator('[data-agent-active="true"]').first()).toBeVisible({ timeout: 15_000 });
  const undo = page.locator('[data-agent-id="agent-undo"]');
  await expect(undo).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-plan-status="executed"]')).toBeVisible();
  expect(await agentTasks(api)).toBe(steps);
  await expect(page.locator('[data-agent-id^="deal-card-"] [data-agent-badge]').first()).toBeVisible();

  await undo.click();
  await expect(page.locator("[data-agent-undone]")).toBeVisible();
  await expect.poll(() => agentTasks(api)).toBe(0);
});

test("S3: move a deal — the card slides to the new column, undo moves it back", async ({ authedPage: page, api }) => {
  test.setTimeout(90_000);
  await api.post(`${API_URL}/api/v1/demo/reset`);
  await page.goto("/pipeline");
  const card = page.locator('[data-agent-id^="deal-card-"]').filter({ hasText: "Acme Analytics" });
  await expect(page.locator('section[aria-label="Lead column"]').locator(card)).toBeVisible();

  await ask(page, "Move Acme to Negotiation");
  const plan = page.locator('[data-plan-status="proposed"]');
  await expect(plan).toBeVisible({ timeout: 30_000 });
  await plan.getByRole("button", { name: "Approve" }).click();

  const negotiation = page.locator('section[aria-label="Negotiation column"]');
  await expect(negotiation.locator(card)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-agent-id="agent-undo"]')).toBeVisible({ timeout: 30_000 });
  const dealId = (await card.getAttribute("data-agent-id"))!.replace("deal-card-", "");
  const deal = (await (await api.get(`${API_URL}/api/v1/deals/${dealId}`)).json()) as { stage: { name: string } };
  expect(deal.stage.name).toBe("Negotiation");

  await page.locator('[data-agent-id="agent-undo"]').click();
  await expect(page.locator('section[aria-label="Lead column"]').locator(card)).toBeVisible({ timeout: 15_000 });
  const after = (await (await api.get(`${API_URL}/api/v1/deals/${dealId}`)).json()) as { stage: { name: string } };
  expect(after.stage.name).toBe("Lead");
});

test("⌘K → Ask AI streams a pipeline report with a chart", async ({ authedPage: page }) => {
  await page.goto("/today");
  await page.keyboard.press("Control+k");
  await page.locator('[data-agent-id="command-input"]').fill("How's the pipeline this month?");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-agent-id="agent-panel"]')).toBeVisible();
  await expect(page.locator('[data-card="chart"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-agent-id="agent-panel"]')).toContainText("weighted");
});

test("record page shows an inline insight and drafts an email that saves to the timeline", async ({ authedPage: page }) => {
  test.setTimeout(60_000);
  await page.goto("/contacts?view=hot");
  await page.locator('[data-agent-id^="contact-row-"] td').first().click();
  const insight = page.locator('[data-agent-id^="insight-contact-"]');
  await expect(insight).toContainText("Suggested next step", { timeout: 15_000 });
  await insight.getByRole("button", { name: "Draft email" }).click();
  const draft = page.locator('[data-card="email_draft"]');
  await expect(draft).toBeVisible({ timeout: 30_000 });
  await draft.getByRole("button", { name: "Save as note" }).click();
  await expect(page.locator('[data-agent-id^="timeline-contact-"]')).toContainText("Email draft", { timeout: 10_000 });
});
