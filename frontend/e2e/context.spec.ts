import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Context Control Center (M3.5 P0-2/P0-3). */
test("context health is explained by facts from real state", async ({ page }) => {
  await signIn(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Context" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Context" })).toBeVisible();
  const health = page.getByRole("region", { name: /Context health/ });
  await expect(health.locator('[data-claim-type="INFERENCE"]').first()).toBeVisible();
  await expect(health).toContainText("Includes synthetic data");
  await expect(health.getByText("Why ROOK says this")).toBeVisible();
  await expect(health.locator('[data-claim-type="FACT"]').first()).toBeVisible();
  await expect(health).toContainText(/Meetings: \d+ you can access/);
});

test("connected sources show account, sync state, permissions and limits", async ({ page }) => {
  await signIn(page);
  await page.goto("/context");
  const demo = page.getByRole("region", { name: /Connected sources/ }).getByRole("article", { name: "Demo workspace" });
  for (const label of ["Account", "Last successful sync", "Last sync result", "What ROOK can read", "Permissions granted", "Limits"]) {
    await expect(demo.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(demo).toContainText("Synthetic demo organisation");
  await demo.getByRole("button", { name: "Sync now" }).click();
  await expect(demo.getByRole("status")).toContainText("Synchronized");
});

test("unbuilt sources are listed without any Connect action; Microsoft 365 explains its setup", async ({ page }) => {
  await signIn(page);
  await page.goto("/context");
  const later = page.getByRole("region", { name: /Available later/ });
  await expect(later).toContainText("Slack");
  await expect(later).toContainText("Messages · Channels · Threads");
  await expect(later.getByRole("button")).toHaveCount(0);
  const available = page.getByRole("region", { name: /^Available(?! later)/ });
  await expect(available).toContainText("Microsoft 365");
  await expect(available).toContainText("Administrator setup required");
  await expect(available.getByRole("button", { name: "Connect" })).toHaveCount(0);
});

test("old Sources links open the Context Control Center", async ({ page }) => {
  await signIn(page);
  await page.goto("/sources?connected=microsoft365&id=1");
  await expect(page).toHaveURL(/\/context\?connected=microsoft365&id=1$/);
  await expect(page.getByRole("main").getByRole("status").first()).toContainText("Connected.");
});
