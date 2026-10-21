import { API_URL, expect, test } from "./fixtures";

test("drag a deal to another stage persists and writes an activity", async ({ authedPage: page, api }) => {
  await page.goto("/pipeline");
  const card = page.locator('[data-agent-id^="deal-card-"]').filter({ hasText: "Acme Analytics — Annual plan" });
  await expect(card).toBeVisible();
  const dealId = (await card.getAttribute("data-agent-id"))!.replace("deal-card-", "");

  const target = page.locator('section[aria-label="Qualified column"]');
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("missing boxes");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 20 });
  await page.mouse.up();

  await expect(target.locator(`[data-agent-id="deal-card-${dealId}"]`)).toBeVisible();
  await expect
    .poll(async () => {
      const res = await api.get(`${API_URL}/api/v1/deals/${dealId}`);
      return ((await res.json()) as { stage: { name: string } }).stage.name;
    })
    .toBe("Qualified");
  const timeline = await api.get(`${API_URL}/api/v1/activities?related_type=deal&related_id=${dealId}`);
  const latest = ((await timeline.json()) as { type: string; payload: { to_stage: string } }[])[0]!;
  expect(latest.type).toBe("stage_changed");
  expect(latest.payload.to_stage).toBe("Qualified");

  // Reload: the move survived.
  await page.reload();
  await expect(page.locator('section[aria-label="Qualified column"]').locator(`[data-agent-id="deal-card-${dealId}"]`)).toBeVisible();
});
