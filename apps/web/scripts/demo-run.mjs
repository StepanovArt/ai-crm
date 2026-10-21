// Dev helper: run the README demo script end to end in one browser session, screenshotting
// each step. Usage: node scripts/demo-run.mjs <outDir>
import { chromium } from "@playwright/test";

const outDir = process.argv[2] ?? ".";
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${outDir}/demo-${n}.png` });
const step = (n, text) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${n}. ${text}`);
const t0 = Date.now();

async function ask(prompt) {
  const before = await page.locator('[data-agent-message="done"]').count();
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Search records, jump to a page, or ask Halo…");
  await input.waitFor();
  await input.fill(prompt);
  await page.waitForTimeout(600);
  if (process.env.DEBUG) await shot(`debug-cmdk-${before}`);
  await page.keyboard.press("Enter");
  try {
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-agent-message="done"]').length > n,
      before,
      { timeout: 60000 },
    );
  } catch (e) {
    await shot("debug-ask");
    throw e;
  }
}
async function approveLatest() {
  const before = await page.locator('[data-agent-message="done"]').count();
  await page.locator('[data-agent-id="plan-approve"]').last().click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-agent-message="done"]').length > n,
    before,
    { timeout: 90000 },
  );
}

// 1. Sign up → describe the business → watch it assemble.
await page.goto(`${WEB}/signup`);
await page.getByLabel("Full name").fill("Jordan Lee");
await page.getByLabel("Work email").fill(`demo-run-${Date.now()}@example.org`);
await page.getByLabel("Password").fill("password123");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "We sell industrial equipment to factories" }).click();
await page.getByTestId("build-workspace").click();
await page.waitForTimeout(3500);
await shot("1-onboarding");
await page.waitForURL("**/today", { timeout: 60000 });
step(1, "onboarding → Today");

// 2. Today: briefing streams, contact queue ranked with reasons.
await page.getByText("Here's what matters today").waitFor({ timeout: 30000 });
await page.getByText("Who to contact next").waitFor();
await page.waitForTimeout(2500);
await shot("2-today");
step(2, "briefing streamed");

// 3. ⌘K → stale deals → plan → approve → tasks → undo.
await ask("Find stale deals and create follow-ups");
await shot("3a-plan");
await approveLatest();
await shot("3b-executed");
const created = await page.locator('[data-agent-id="agent-undo"]').last().innerText();
await page.locator('[data-agent-id="agent-undo"]').last().click();
await page.locator("[data-agent-undone]").last().waitFor({ timeout: 15000 });
step(3, `plan approved (${created.trim()}) and undone`);

// 4. Move a deal to Negotiation → card slides.
await ask("Move Bergmann to Negotiation");
await approveLatest();
await page.waitForTimeout(800);
await shot("4-moved");
const negotiation = page.getByRole("region", { name: "Negotiation column" });
const moved = await negotiation.getByText(/Bergmann/).count();
step(4, `deal moved, Bergmann cards in Negotiation column: ${moved}`);

// 5. Contact → insight → draft email → save as note.
await page.goto(`${WEB}/contacts?sort=-score`);
await page.locator("tbody tr[data-agent-id]").first().locator("a").first().click();
await page.waitForURL("**/records/contact/**");
await page.getByRole("button", { name: "Draft email" }).click();
await page.getByRole("button", { name: "Save as note" }).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "Save as note" }).click();
await page.getByRole("button", { name: "Saved as note" }).waitFor();
await page.waitForTimeout(800);
await shot("5-email-saved");
step(5, "email drafted and saved as note");

// 6. Pipeline this month → chart card.
await ask("How's the pipeline this month?");
await page.locator(".recharts-wrapper").last().waitFor({ timeout: 15000 });
await shot("6-chart");
step(6, "pipeline chart card");

// 7. Settings → add a custom field → appears in the table.
await page.goto(`${WEB}/settings`);
await page.getByRole("button", { name: "Add field" }).click();
await page.getByLabel("Label").fill("Plant manager");
await page.getByRole("button", { name: /^(Add|Create|Save)( field)?$/ }).last().click();
await page.waitForTimeout(800);
await page.goto(`${WEB}/deals`);
await page.getByRole("columnheader", { name: "Plant manager" }).waitFor({ timeout: 15000 });
await shot("7-field");
step(7, "custom field visible in table");

console.log(errors.length ? `browser errors:\n${errors.join("\n")}` : "no browser errors");
await browser.close();
