import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Visual evidence for the PR (docs/screenshots). Run with CAPTURE_SCREENSHOTS=1. */
test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 to refresh docs/screenshots");

const OUT = "../docs/screenshots";

test("capture P0 screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Enter demo" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/00-login.png` });
  await signIn(page);
  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

  await page.goto("/meetings");
  await page.getByRole("link", { name: "Phoenix Product Review" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Purpose/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-meeting-preparation.png`, fullPage: true });

  await page.goto("/ask");
  await page.getByRole("button", { name: "What changed and what should I do?" }).click();
  const answer = page.getByRole("article");
  await expect(answer.locator('[data-unit-type="UNKNOWN"]')).toBeVisible();
  await answer.locator('[data-unit-type="INFERENCE"]').getByText(/Source · \d+ sources/).click();
  await page.screenshot({ path: `${OUT}/03-ask-what-changed.png`, fullPage: true });
  await answer.locator('[data-unit-type="RECOMMENDATION"]').getByRole("button", { name: "Draft follow-up" }).click();
  await expect(page.getByText("Nothing is sent until you approve")).toBeVisible();
  await page.getByRole("region", { name: /Follow up with/ }).screenshot({ path: `${OUT}/04-followup-draft-approval.png` });

  await page.goto("/risks");
  await page.getByRole("link", { name: /Project Phoenix at risk/ }).click();
  await expect(page.getByText("Why ROOK detected it")).toBeVisible();
  await page.screenshot({ path: `${OUT}/05-risk-detail.png`, fullPage: true });

  await page.goto("/decisions?tab=made");
  await page.getByRole("link", { name: /Launch Project Phoenix/ }).click();
  await expect(page.getByText("Decision owner", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${OUT}/06-decision-detail.png`, fullPage: true });

  await page.goto("/commitments?tab=waiting");
  await expect(page.getByRole("heading", { level: 1, name: "Commitments" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/07-commitments.png`, fullPage: true });

  await page.goto("/sources");
  await expect(page.getByRole("heading", { level: 1, name: "Sources" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/08-sources.png`, fullPage: true });

  await page.goto("/evidence/1");
  await expect(page.getByText("Source type", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${OUT}/09-evidence.png`, fullPage: true });

  await page.goto("/meetings");
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/11-meetings.png`, fullPage: true });

  await page.goto("/risks");
  await expect(page.getByRole("heading", { level: 1, name: "Risks" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/12-risks.png`, fullPage: true });

  await page.goto("/decisions?tab=all");
  await expect(page.getByRole("heading", { level: 1, name: "Decisions" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/13-decisions.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${OUT}/10-home-mobile.png` });
});
