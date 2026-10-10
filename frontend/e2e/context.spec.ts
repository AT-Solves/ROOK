import { expect, test } from "@playwright/test";

import { withMicrosoft365 } from "./context-fixture";
import { signIn } from "./helpers";

/** Context Control Center (M3.5 P0-2/P0-3). */
test("context health states its level and the facts behind it", async ({ page }) => {
  await signIn(page);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Context" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Context" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("ROOK continuously builds context from the systems your organization already uses.");
  const health = page.getByRole("region", { name: "Context health" });
  await expect(health.locator('[data-claim-type="INFERENCE"]').first()).toBeVisible();
  await expect(health).toContainText(/Strong context|Partial context|Limited context/);
  await expect(health).toContainText("Includes synthetic data");
  await expect(health.getByRole("heading", { name: /What ROOK can access/ })).toBeVisible();
  await expect(health.getByRole("heading", { name: /Limitations/ })).toBeVisible();
  await expect(health).toContainText(/Meetings: \d+ you can access/);
});

test("a connected source shows account, access, synchronization and permissions", async ({ page }) => {
  await signIn(page);
  await page.goto("/context");
  const demo = page.getByRole("region", { name: /^Connected/ }).getByRole("article", { name: "Demo workspace" });
  for (const heading of ["Access", "Synchronization", "Permissions granted"]) {
    await expect(demo.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(demo).toContainText("Account: Synthetic demo organisation");
  await expect(demo).toContainText("Calendar — Available");
  await expect(demo).toContainText("Last successful");
  await expect(demo.getByRole("button", { name: "Disconnect" })).toHaveCount(0); // the synthetic workspace stays
  await demo.getByRole("button", { name: "Sync now" }).click();
  await expect(demo.getByRole("status")).toContainText("Synchronized");
});

test("unbuilt sources are listed without any Connect action; Microsoft 365 explains its setup", async ({ page }) => {
  await signIn(page);
  await page.goto("/context");
  const later = page.getByRole("region", { name: /Available later/ });
  await expect(later).toContainText("Slack");
  await expect(later).toContainText("Messages · Channels · Threads");
  await expect(later).toContainText("Atlassian");
  await expect(later).toContainText("Confluence · Jira");
  await expect(later).toContainText("Google Workspace");
  await expect(later.getByRole("button")).toHaveCount(0);
  const available = page.getByRole("region", { name: /^Available(?! later)/ });
  await expect(available).toContainText("Microsoft 365");
  await expect(available).toContainText("Administrator setup required");
  await expect(available.getByRole("button", { name: "Connect" })).toHaveCount(0);
});

test("a connected Microsoft 365 source shows what ROOK can and cannot read", async ({ page }) => {
  await signIn(page);
  await withMicrosoft365(page);
  await page.goto("/context");
  const ms = page.getByRole("region", { name: /^Connected/ }).getByRole("article", { name: "Microsoft 365" });
  await expect(ms).toContainText("Account: yamini@contoso.example");
  await expect(ms).toContainText("Outlook mail — Available");
  await expect(ms).toContainText("Calendar — Available");
  await expect(ms).toContainText("Teams meeting transcripts — Administrator permission required");
  await expect(ms).toContainText("HTTP 403");
  await expect(ms.getByRole("list", { name: "Sync warnings" })).toContainText("Transcript unavailable");
  await expect(ms.getByRole("button", { name: "Reconnect" })).toBeVisible();
  await ms.getByRole("button", { name: "Disconnect" }).click();
  await expect(ms.getByRole("button", { name: "Confirm disconnect" })).toBeVisible();
  await ms.getByRole("button", { name: "Cancel" }).click();
  await expect(ms.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("old Sources links and the OAuth return open the Context Control Center", async ({ page }) => {
  await signIn(page);
  await page.goto("/sources?connected=microsoft365&id=1");
  await expect(page).toHaveURL(/\/context\?connected=microsoft365&id=1$/);
  await expect(page.getByRole("main").getByRole("status").first()).toContainText("Connected.");
});
