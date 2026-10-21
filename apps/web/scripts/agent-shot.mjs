// Dev helper: send a prompt to the agent in a real browser and screenshot along the way.
// Usage: node scripts/agent-shot.mjs <outDir> <startPath> "<prompt>" [approve] [theme]
import { chromium } from "@playwright/test";

const [, , outDir, startPath, prompt, approve, theme = "light"] = process.argv;
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
await ctx.request.post(`${API}/api/v1/auth/login`, { data: { email: "demo@halo.dev", password: "demo1234" } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(`${WEB}${startPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (!(await page.locator('[data-agent-id="agent-panel"]').isVisible())) {
  await page.locator('[data-agent-id="topbar-ask-ai"]').click();
}
await page.locator('[data-agent-id="agent-input"]').fill(prompt);
await page.keyboard.press("Enter");
const slug = prompt.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/${slug}-1-streaming.png` });
await page.waitForSelector('[data-agent-message="done"], [data-agent-message="error"]', { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/${slug}-2-done.png` });
if (approve) {
  await page.locator('[data-agent-id="plan-approve"]').last().click();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${outDir}/${slug}-3-running.png` });
  await page.waitForFunction(() => document.querySelectorAll('[data-agent-message="done"]').length >= 2, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/${slug}-4-executed.png` });
}
console.log("ok");
await browser.close();
