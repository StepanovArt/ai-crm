import { API_URL, expect, test } from "./fixtures";

test("create, inline-edit and delete a company", async ({ authedPage: page }) => {
  await page.goto("/companies");
  await page.getByRole("button", { name: /New company/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Playwright Industries");
  await dialog.getByLabel("Domain").fill("playwright.dev");
  await page.getByRole("button", { name: "Create company" }).click();
  await expect(page.getByText("Company created")).toBeVisible();

  await page.getByLabel("Search companies…").fill("Playwright");
  const row = page.locator('[data-agent-id^="company-row-"]').filter({ hasText: "Playwright Industries" });
  await expect(row).toHaveCount(1);

  // Inline edit the industry cell.
  await row.getByRole("button", { name: "Edit Industry" }).click();
  const editor = page.getByRole("textbox", { name: "Industry" });
  await editor.fill("Testing tools");
  await editor.press("Enter");
  await expect(row).toContainText("Testing tools");

  // Open the record from its name cell, then delete it.
  await row.getByText("Playwright Industries").click();
  await expect(page.getByRole("heading", { name: "Playwright Industries" })).toBeVisible();
  await expect(page.locator("text=updated").first()).toBeVisible();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/companies$/);
});

test("a custom field created via the API appears in table and detail", async ({ authedPage: page, api }) => {
  const res = await api.post(`${API_URL}/api/v1/fields`, {
    data: { object_type: "company", label: "Support tier", type: "select", options: [{ label: "Gold" }, { label: "Silver" }] },
  });
  expect(res.ok()).toBeTruthy();
  const field = (await res.json()) as { id: string };
  try {
    await page.goto("/companies");
    await expect(page.getByRole("columnheader", { name: "Support tier" })).toBeVisible();
    await page.locator('[data-agent-id^="company-row-"] td').first().click();
    const panel = page.locator('[data-agent-id="custom-fields-company"]');
    await expect(panel).toContainText("Support tier");
    await panel.getByRole("button", { name: "Edit Support tier" }).click();
    await page.getByRole("option", { name: "Gold" }).click();
    await expect(panel).toContainText("Gold");
  } finally {
    await api.delete(`${API_URL}/api/v1/fields/${field.id}`);
  }
});

test("record page shows timeline and saves a note", async ({ authedPage: page }) => {
  await page.goto("/contacts?view=hot");
  await page.locator('[data-agent-id^="contact-row-"] td').first().click();
  await expect(page.locator('[data-agent-id^="timeline-contact-"]')).toBeVisible();
  await page.getByLabel("Write a note").fill("Prefers a Thursday call.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.locator('[data-agent-id^="timeline-contact-"]')).toContainText("Prefers a Thursday call.");
});

test("tasks page groups and completes a task", async ({ authedPage: page }) => {
  await page.goto("/tasks");
  const today = page.locator('[data-agent-id="task-group-today"]');
  await expect(today).toContainText("Today");
  const first = today.locator('[data-agent-id^="task-"]').first();
  const title = (await first.locator("span.truncate").first().textContent()) ?? "";
  await first.getByRole("checkbox").click();
  await page.locator('[data-agent-id="task-group-done"] button').first().click();
  await expect(page.locator('[data-agent-id="task-group-done"]')).toContainText(title.trim());
});
