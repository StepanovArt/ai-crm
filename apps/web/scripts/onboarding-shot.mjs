// Dev helper: sign up a fresh user, run onboarding, screenshot each stage.
// Usage: node scripts/onboarding-shot.mjs <outDir> <theme> "<description>" [prefix]
import { chromium } from "@playwright/test";

const [, , outDir, theme = "light", description = "We sell apartments in new developments", prefix = "onb"] =
  process.argv;
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) },
  colorScheme: theme === "dark" ? "dark" : "light",
});
const email = `shot-${Date.now()}@example.org`;
const res = await ctx.request.post(`${API}/api/v1/auth/signup`, {
  data: { email, password: "password123", full_name: "Sam Rivera" },
});
if (!res.ok()) throw new Error(`signup failed ${res.status()}`);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
const shot = async (name) => {
  const path = `${outDir}/${prefix}-${name}-${theme}.png`;
  await page.screenshot({ path });
  console.log(path);
};
await page.goto(`${WEB}/onboarding`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("1-idle");
await page.getByLabel("Your business in one sentence").fill(description);
await page.getByTestId("build-workspace").click();
const start = Date.now();
for (const at of (process.env.AT ?? "1800,3800,6000").split(",").map(Number)) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - start)));
  await shot(`2-building-${at}`);
}
await page.getByText("Your workspace is ready").waitFor({ timeout: 30000 });
await page.waitForTimeout(900);
await shot("3-done");
await page.waitForURL("**/today", { timeout: 15000 });
await page.waitForTimeout(2500);
await shot("4-today");
await page.goto(`${WEB}/pipeline`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("5-pipeline");
await browser.close();
