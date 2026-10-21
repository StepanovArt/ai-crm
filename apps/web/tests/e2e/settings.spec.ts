import { API_URL, expect, test } from "./fixtures";

test("adding a field in settings shows it in the table immediately", async ({ authedPage: page, api }) => {
  await page.goto("/settings?tab=fields");
  await page.getByRole("button", { name: "Add field" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Decision date");
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: /^Date/ }).click();
  await dialog.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByText("Decision date").first()).toBeVisible();

  await page.locator('[data-agent-id="nav-deals"]').click();
  await expect(page.getByRole("columnheader", { name: "Decision date" })).toBeVisible();

  const fields = (await (await api.get(`${API_URL}/api/v1/fields?object_type=deal`)).json()) as { id: string; key: string }[];
  const created = fields.find((f) => f.key === "decision_date");
  if (created) await api.delete(`${API_URL}/api/v1/fields/${created.id}`);
});

test("renaming terminology relabels navigation", async ({ authedPage: page, api }) => {
  await page.goto("/settings?tab=workspace");
  await page.getByLabel("Deals (plural)").fill("Opportunities");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator('[data-agent-id="nav-deals"]')).toHaveText("Opportunities");
  await api.patch(`${API_URL}/api/v1/workspaces/current`, { data: { terminology: { deals: "Deals" } } });
});

test("adding a stage shows a new kanban column", async ({ authedPage: page, api }) => {
  await page.goto("/settings?tab=pipelines");
  await page.getByLabel("New stage name").fill("Security review");
  await page.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByLabel("Stage name").nth(5)).toHaveValue("Security review");
  await page.locator('[data-agent-id="nav-pipeline"]').click();
  await expect(page.locator('section[aria-label="Security review column"]')).toBeVisible();
  const pipelines = (await (await api.get(`${API_URL}/api/v1/pipelines`)).json()) as { stages: { id: string; name: string }[] }[];
  const stage = pipelines[0]!.stages.find((s) => s.name === "Security review");
  if (stage) await api.delete(`${API_URL}/api/v1/stages/${stage.id}`);
});
