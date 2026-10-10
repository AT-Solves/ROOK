import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers";

/** WCAG 2.2 AA (UX §15): no serious or critical axe violations on any P0 screen. */
async function audit(page: Page, name: string) {
  // @axe-core/playwright bundles newer playwright-core typings than @playwright/test; the runtime API is the same.
  const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${name}: ${v.id} — ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`)).toEqual([]);
}

test("login screen", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
  await audit(page, "login");
  await page.getByText("Explore a synthetic workspace").click();
  await expect(page.getByRole("button", { name: "Enter demo" })).toBeVisible();
  await audit(page, "login: synthetic workspace open");
});

test("all P0 workspace screens", async ({ page }) => {
  await signIn(page);
  await page.waitForLoadState("networkidle");
  await audit(page, "home");
  await page.getByRole("button", { name: "See situation" }).click();
  await audit(page, "home: situation expanded");

  await page.goto("/ask");
  await page.getByRole("button", { name: "What changed and what should I do?" }).click();
  await expect(page.getByRole("article")).toBeVisible();
  await audit(page, "ask");

  for (const [path, heading] of [["/meetings", "Meetings"], ["/decisions", "Decisions"], ["/commitments", "Commitments"], ["/risks", "Risks"], ["/context", "Context"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await audit(page, path);
  }

  await page.goto("/meetings");
  await page.getByRole("link", { name: "Phoenix Product Review" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Purpose/ })).toBeVisible();
  await audit(page, "meeting detail");

  await page.goto("/risks");
  await page.getByRole("link", { name: /Project Phoenix at risk/ }).click();
  await expect(page.getByText("Why ROOK detected it")).toBeVisible();
  await audit(page, "risk detail");

  await page.getByRole("region", { name: /Related decisions/ }).getByRole("link").first().click();
  await expect(page.getByText("Decision owner", { exact: true })).toBeVisible();
  await audit(page, "decision detail");

  await page.getByRole("region", { name: /Related actions/ }).getByRole("link").first().click();
  await expect(page.getByText("Related decision", { exact: true })).toBeVisible();
  await audit(page, "commitment detail");

  await page.getByRole("region", { name: "Evidence" }).getByRole("link").first().click();
  await expect(page.getByText("Source type", { exact: true })).toBeVisible();
  await audit(page, "evidence");
});
