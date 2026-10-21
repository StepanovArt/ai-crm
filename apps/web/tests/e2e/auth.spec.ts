import { expect, test } from "@playwright/test";

test("redirects to login and signs in with the demo account", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/login\?next=%2Fcompanies/);
  await page.getByLabel("Email").fill("demo@halo.dev");
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.locator('[data-agent-id="nav-companies"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-agent-id="nav-tasks"]').click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test("shows an error for a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@halo.dev");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});
