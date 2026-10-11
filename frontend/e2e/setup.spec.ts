import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers";

/**
 * First-administrator setup (ADR-0011). The API decides who must complete setup (tests/test_identity.py); here the
 * /api/me response is that of the first user of a new Microsoft tenant, so the browser flow can be exercised.
 */
async function asNewOrganizationOwner(page: Page) {
  let done = false;
  await page.route("**/api/me", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const real = await (await route.fetch()).json();
    await route.fulfill({ json: { ...real, org: { ...real.org, name: "Fabrikam", status: done ? "active" : "setup", is_demo: false, identity_provider: "microsoft", is_owner: true, setup_required: !done } } });
  });
  await page.route("**/api/org/setup", async (route) => {
    done = true;
    const { name } = route.request().postDataJSON();
    await route.fulfill({ json: { id: 99, name, status: "active", is_demo: false, identity_provider: "microsoft", is_owner: true, setup_required: false } });
  });
}

test("the first administrator of a new organization is guided through setup", async ({ page }) => {
  await signIn(page);
  await asNewOrganizationOwner(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { level: 1, name: "Set up your organization" })).toBeVisible();
  const name = page.getByLabel("Organization name");
  await expect(name).toHaveValue("Fabrikam");
  await name.fill("Fabrikam Ltd");
  await page.getByRole("button", { name: "Confirm organization" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Connect Microsoft 365" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Fabrikam Ltd is ready/ })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // the workspace has loaded
  await page.unrouteAll({ behavior: "ignoreErrors" }); // don't let an in-flight mocked request outlive the test
});

test("existing organizations go straight to the workspace", async ({ page }) => {
  await signIn(page);
  await page.goto("/setup");
  await expect(page).not.toHaveURL(/\/setup/);
});

test("the login page speaks to any Microsoft organization", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to ROOK" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Use your Microsoft work or school account." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
});
