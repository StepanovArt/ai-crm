// Dev helper: measure table render + scroll smoothness for a large workspace.
// Usage: EMAIL=perf@halo.dev PASSWORD=perf12345 node scripts/perf-table.mjs /contacts
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const path = process.argv[2] ?? "/contacts";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const res = await ctx.request.post(`${API}/api/v1/auth/login`, {
  data: { email: process.env.EMAIL ?? "perf@halo.dev", password: process.env.PASSWORD ?? "perf12345" },
});
if (!res.ok()) throw new Error(`login failed ${res.status()}`);
const page = await ctx.newPage();
await page.goto(`${WEB}/today`, { waitUntil: "networkidle" }); // warm up the dev compiler
const t0 = Date.now();
await page.goto(`${WEB}${path}`);
await page.locator("tbody tr[data-agent-id]").first().waitFor({ timeout: 30000 });
const first = Date.now() - t0;
if (!process.env.SMALL) await page.locator("tbody tr").nth(400).waitFor({ state: "attached", timeout: 30000 });
const rows = await page.locator("tbody tr").count();
console.log(`first row ${first}ms, rows=${rows} after ${Date.now() - t0}ms`);
if (!process.env.SMALL) {
  await page.locator("tbody tr").nth(499).waitFor({ state: "attached", timeout: 30000 });
  console.log(`all rows after ${Date.now() - t0}ms`);
  await page.waitForTimeout(500);
}
const stats = await page.evaluate(async () => {
  const scroller = [...document.querySelectorAll("*")].find(
    (el) => el.scrollHeight > el.clientHeight + 500 && /(auto|scroll)/.test(getComputedStyle(el).overflowY),
  );
  if (!scroller) return null;
  const frames = [];
  let last = performance.now();
  let running = true;
  const tick = (now) => {
    frames.push(now - last);
    last = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (let i = 0; i < 120; i++) {
    scroller.scrollTop += 120;
    await new Promise((r) => requestAnimationFrame(r));
  }
  running = false;
  frames.sort((a, b) => a - b);
  const p = (q) => frames[Math.floor(frames.length * q)].toFixed(1);
  return { frames: frames.length, p50: p(0.5), p95: p(0.95), max: frames.at(-1).toFixed(1) };
});
console.log("scroll frame ms", stats);
await page.evaluate((fixed) => { document.querySelector("tbody tr")?.scrollIntoView(); if (fixed) document.querySelector("table").style.tableLayout = "fixed"; }, Boolean(process.env.FIXED));
const box = page.getByRole("checkbox", { name: "Select row" }).nth(1);
await box.hover();
const s0 = Date.now();
await box.click();
await page.waitForFunction(
  () => document.querySelectorAll('tbody [aria-label="Select row"][data-state="checked"]').length === 1,
);
console.log(`select one row: ${Date.now() - s0}ms`);
const box2 = page.getByRole("checkbox", { name: "Select row" }).nth(2);
const s1 = Date.now();
await box2.click();
await page.waitForFunction(
  () => document.querySelectorAll('tbody [aria-label="Select row"][data-state="checked"]').length === 2,
);
console.log(`select another row: ${Date.now() - s1}ms`);
await browser.close();
