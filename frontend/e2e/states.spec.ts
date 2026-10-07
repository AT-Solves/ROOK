import { expect, test } from "@playwright/test";

import { restrictedSignalId, signIn } from "./helpers";

test("unauthenticated visitors are sent to sign in", async ({ page }) => {
  await page.goto("/risks");
  await expect(page).toHaveURL(/\/login\?return_to=%2Frisks/);
  await expect(page.getByRole("heading", { name: "Sign in with your organisation" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Microsoft sign-in isn't configured");
});

test("restricted sources show a permission-denied state, not their content", async ({ page, request }) => {
  const id = await restrictedSignalId(request, "yamini@acme.example");
  await signIn(page);
  await page.goto(`/evidence/${id}`);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("You don't have access to this source.");
  await expect(page.getByRole("main")).not.toContainText("compensation");
});

test("server errors explain what failed and offer a retry", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/risks", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.goto("/risks");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Couldn't load the risk radar.");
  await expect(alert).toContainText("No action needed from you.");
  await page.unroute("**/api/risks");
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: /Project Phoenix at risk/ })).toBeVisible();
});

test("unknown answers say so instead of guessing", async ({ page }) => {
  await signIn(page);
  await page.goto("/ask");
  await page.getByLabel("Ask ROOK a question").fill("What did we decide about the office move?");
  await page.getByRole("button", { name: "Ask ROOK", exact: true }).click();
  const answer = page.getByRole("article");
  await expect(answer).toContainText("I couldn't find enough evidence");
  await expect(answer.locator("[data-claim-type]").first()).toHaveAttribute("data-claim-type", "UNKNOWN");
});

test("keyboard: skip link first, visible focus, and navigation without a mouse", async ({ page }) => {
  await signIn(page);
  await page.goto("/"); // fresh document load: focus starts at the top of the page
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // reach the Meetings nav link by keyboard and open it
  const meetings = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Meetings" });
  await meetings.focus();
  const outline = await meetings.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
});
