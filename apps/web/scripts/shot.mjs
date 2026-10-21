// Usage: node scripts-shot.mjs <url> <out.png> [dark] [loginEmail]
import { chromium } from "@playwright/test";
const [, , url, out, theme] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme === "dark" ? "dark" : "light" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
