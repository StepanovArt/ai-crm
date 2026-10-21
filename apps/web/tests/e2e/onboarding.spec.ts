import { expect, test } from "@playwright/test";

const uniqueEmail = (tag: string) => `${tag}-${Date.now()}@example.org`;

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Sam Rivera");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

test("one sentence builds a real-estate workspace", async ({ page }) => {
  await signUp(page, uniqueEmail("estate"));
  await expect(
    page.getByRole("heading", { name: "Describe your business in one sentence" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "We sell apartments in new developments" }).click();
  await expect(page.getByLabel("Your business in one sentence")).toHaveValue(
    "We sell apartments in new developments",
  );
  await page.getByTestId("build-workspace").click();

  await expect(
    page.getByRole("heading", { name: "Building a real estate workspace" }),
  ).toBeVisible();
  const steps = page.getByRole("list", { name: "Setup steps" });
  await expect(steps.getByText(/Creating pipeline: Lead → Viewing → Offer/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible({
    timeout: 30_000,
  });

  // Lands on Today with the new vocabulary in the sidebar.
  await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 });
  await expect(page.locator('[data-agent-id="nav-deals"]')).toHaveText(/Sales/);
  await expect(page.locator('[data-agent-id="nav-companies"]')).toHaveText(/Households/);
  await expect(page.locator('[data-agent-id="nav-contacts"]')).toHaveText(/Buyers/);

  await page.locator('[data-agent-id="nav-pipeline"]').click();
  for (const stage of ["Lead", "Viewing", "Offer", "Reservation", "Contract"]) {
    await expect(page.getByRole("region", { name: `${stage} column` })).toBeVisible();
  }

  // Onboarding is done: the page now sends you back into the app.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/today$/);
});

test("skip uses the demo workspace", async ({ page }) => {
  await signUp(page, uniqueEmail("skip"));
  await page.getByRole("button", { name: "Skip, use demo workspace" }).click();
  await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 });
  await expect(page.locator('[data-agent-id="nav-deals"]')).toHaveText(/Deals/);
  await page.locator('[data-agent-id="nav-pipeline"]').click();
  await expect(page.getByRole("region", { name: "Proposal column" })).toBeVisible();
});
