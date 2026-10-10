import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers";

/** Visual evidence for design review (docs/screenshots): every P0 screen, desktop + tablet + phone. Run with CAPTURE_SCREENSHOTS=1. */
test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 to refresh docs/screenshots");
test.setTimeout(120_000);

const OUT = "../docs/screenshots";

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

test("capture P0 screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Enter demo" })).toBeVisible();
  await shot(page, "00-login", false);
  await signIn(page);
  await shot(page, "01-home-1440x900", false);
  await shot(page, "01-home");
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, "01-home-1280x800", false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "See situation" }).click();
  await page.getByRole("region", { name: /One thing needs your judgment/ }).screenshot({ path: `${OUT}/18-home-situation-expanded.png` });
  await page.getByRole("region", { name: /^Watch/ }).screenshot({ path: `${OUT}/20-home-watch.png` });

  await page.goto("/ask");
  await page.getByRole("button", { name: "What changed and what should I do?" }).click();
  const answer = page.getByRole("article");
  await expect(answer.locator('[data-unit-type="UNKNOWN"]')).toBeVisible();
  await answer.locator('[data-unit-type="INFERENCE"]').getByText(/Source · \d+ sources/).click();
  await shot(page, "02-ask");
  await answer.locator('[data-unit-type="RECOMMENDATION"]').getByRole("button", { name: "Draft follow-up" }).click();
  await expect(page.getByText("Nothing is sent until you approve")).toBeVisible();
  await page.getByRole("region", { name: /Follow up with/ }).screenshot({ path: `${OUT}/13-followup-draft.png` });

  await page.goto("/meetings");
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
  await shot(page, "03-meetings");
  await page.getByRole("link", { name: "Phoenix Product Review" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Purpose/ })).toBeVisible();
  await shot(page, "04-meeting-detail");

  await page.goto("/decisions?tab=all");
  await expect(page.getByRole("heading", { level: 1, name: "Decisions" })).toBeVisible();
  await shot(page, "05-decisions");
  await page.getByRole("link", { name: /Launch Project Phoenix/ }).click();
  await expect(page.getByText("Decision owner", { exact: true })).toBeVisible();
  await shot(page, "06-decision-detail");

  await page.goto("/commitments?tab=waiting");
  await expect(page.getByRole("heading", { level: 1, name: "Commitments" })).toBeVisible();
  await shot(page, "07-commitments");
  await page.getByRole("link", { name: /financial forecast/ }).first().click();
  await expect(page.getByText("Related decision", { exact: true })).toBeVisible();
  await shot(page, "08-commitment-detail");

  await page.goto("/risks");
  await expect(page.getByRole("heading", { level: 1, name: "Risks" })).toBeVisible();
  await shot(page, "09-risks");
  await page.getByRole("link", { name: /Project Phoenix at risk/ }).click();
  await expect(page.getByText("Why ROOK detected it")).toBeVisible();
  await shot(page, "10-risk-detail");

  await page.goto("/sources");
  await expect(page.getByRole("heading", { level: 1, name: "Sources" })).toBeVisible();
  await shot(page, "11-sources");

  await page.goto("/evidence/1");
  await expect(page.getByText("Source type", { exact: true })).toBeVisible();
  await shot(page, "12-evidence");

  await page.setViewportSize({ width: 900, height: 1100 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "14-home-tablet", false);

  // No critical situation: the same brief with nothing needing judgment.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/brief", async (route) => {
    const res = await route.fetch();
    const b = await res.json();
    await route.fulfill({ response: res, json: { ...b, attention: [], risks: [], waiting_for: [], decisions_pending: [], my_commitments: [], counts: { ...b.counts, attention: 0, risks: 0, waiting_for: 0, decisions_pending: 0 } } });
  });
  await page.goto("/");
  await expect(page.getByText("ROOK sees no immediate situation requiring your judgment.")).toBeVisible();
  await shot(page, "19-home-no-critical-situation", false);
  await page.unroute("**/api/brief");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "15-home-mobile", false);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Enter demo" })).toBeVisible();
  await shot(page, "17-login-mobile");
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Enter demo" })).toBeVisible();
  await shot(page, "16-login-tablet", false);
});
