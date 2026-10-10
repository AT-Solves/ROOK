import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Executive Command Center (docs/design/ROOK_HOME_UX_SPEC.md). */
test("Home briefs without asking: no Ask request (and no audit record) until the user asks", async ({ page }) => {
  const asks: string[] = [];
  page.on("request", (r) => r.url().endsWith("/api/ask") && asks.push(r.method()));
  await signIn(page);
  await expect(page.getByRole("region", { name: /One thing needs your judgment/ }).getByRole("article")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(asks).toEqual([]);

  await page.getByRole("button", { name: "See full briefing" }).click();
  const units = page.getByRole("region", { name: /One thing needs your judgment/ }).locator("[data-unit-type]");
  await expect(units).toHaveCount(4);
  expect(asks).toEqual(["POST"]);
});

test("situation expands in place and links to existing detail pages", async ({ page }) => {
  await signIn(page);
  const card = page.getByRole("region", { name: /One thing needs your judgment/ }).getByRole("article");
  await card.getByRole("button", { name: "See situation" }).click();
  await expect(card.getByRole("button", { name: "Hide situation" })).toHaveAttribute("aria-expanded", "true");
  await expect(card.getByText("People involved:")).toBeVisible();
  await card.getByRole("link", { name: /^D-1001 · / }).first().click();
  await expect(page.getByText("Decision owner", { exact: true })).toBeVisible();
});

test("each situation appears once; the pulse is navigation", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("article").filter({ hasText: "Project Phoenix at risk: dependency delayed" })).toHaveCount(1);
  const pulse = page.getByRole("navigation", { name: "Executive pulse" });
  await pulse.getByRole("link", { name: /decision(s)? pending/ }).click();
  await expect(page).toHaveURL(/\/decisions\?tab=pending/);
  await expect(page.getByRole("heading", { level: 1, name: "Decisions" })).toBeVisible();
});

test("calm state when nothing needs judgment", async ({ page }) => {
  await page.route("**/api/brief", async (route) => {
    const res = await route.fetch();
    const b = await res.json();
    await route.fulfill({ response: res, json: { ...b, attention: [], risks: [], waiting_for: [], decisions_pending: [], my_commitments: [], counts: { ...b.counts, attention: 0, risks: 0, waiting_for: 0, decisions_pending: 0 } } });
  });
  await signIn(page);
  await expect(page.getByText("ROOK sees no immediate situation requiring your judgment.")).toBeVisible();
  await expect(page.getByRole("region", { name: /^Today's moves/ })).toBeVisible();
});

test("mobile: priority situation first, then moves, today and watch in one column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const order = await page.locator("main section[aria-labelledby]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-labelledby")));
  expect(order.slice(0, 4)).toEqual(["h-judgment", "h-moves", "h-today", "h-watch"]);
  const box = await page.getByRole("region", { name: /Your next moves/ }).boundingBox();
  expect(box!.width).toBeGreaterThan(300); // a full-width column, not a squeezed desktop column
});
