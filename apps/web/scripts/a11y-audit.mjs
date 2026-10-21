// Dev helper: list axe WCAG A/AA violations per page. Usage: [THEME=dark] node scripts/a11y-audit.mjs /today /pipeline
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: process.env.THEME ?? "light" });
await ctx.request.post("http://localhost:8000/api/v1/auth/login", { data: { email: "demo@halo.dev", password: "demo1234" } });
const page = await ctx.newPage();
const seen = new Map();
for (const p of process.argv.slice(2)) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("[data-sonner-toaster]").analyze();
  for (const v of r.violations) for (const n of v.nodes) {
    const key = `${v.id} | ${n.html.slice(0, 140)}`;
    if (!seen.has(key)) { seen.set(key, `${p} :: ${(n.any[0]?.message ?? n.failureSummary ?? "").slice(0, 160)}`); }
  }
}
for (const [k, v] of seen) console.log(k, "\n    ", v);
await browser.close();
