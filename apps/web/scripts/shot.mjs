// Dev helper: screenshot pages, signed in as the demo user.
// Usage: node scripts/shot.mjs <outDir> <theme:light|dark> <path> [path...]
import { chromium } from "@playwright/test";

const [, , outDir, theme = "light", ...paths] = process.argv;
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: theme === "dark" ? "dark" : "light",
  deviceScaleFactor: 1,
});
if (!process.env.ANON) {
  const res = await ctx.request.post(`${API}/api/v1/auth/login`, {
    data: { email: process.env.EMAIL ?? "demo@halo.dev", password: process.env.PASSWORD ?? "demo1234" },
  });
  if (!res.ok()) throw new Error(`login failed ${res.status()}`);
}
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
for (const p of paths) {
  await page.goto(`${WEB}${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(Number(process.env.WAIT ?? 900));
  for (const key of (process.env.PRESS ?? "").split(",").filter(Boolean)) {
    await page.keyboard.press(key);
    await page.waitForTimeout(400);
  }
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.screenshot({ path: `${outDir}/${name}-${theme}.png`, fullPage: Boolean(process.env.FULL) });
  console.log(`${outDir}/${name}-${theme}.png`);
}
await browser.close();
