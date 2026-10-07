import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Visual evidence for the PR (docs/screenshots). Run with CAPTURE_SCREENSHOTS=1. */
test.skip(!process.env.CAPTURE_SCREENSHOTS, "set CAPTURE_SCREENSHOTS=1 to refresh docs/screenshots");

const OUT = "../docs/screenshots";

test("capture P0 screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

  await page.goto("/meetings");
  await page.getByRole("link", { name: "Phoenix Product Review" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Purpose/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-meeting-preparation.png`, fullPage: true });

  await page.goto("/ask");
  await page.getByRole("button", { name: "What changed and what should I do?" }).click();
  const answer = page.getByRole("article");
  await expect(answer.getByRole("heading", { name: "Why it matters" })).toBeVisible();
  await answer.getByText(/Evidence · \d+ sources/).first().click();
  await page.screenshot({ path: `${OUT}/03-ask-what-changed.png`, fullPage: true });
  await answer.getByRole("button", { name: "Draft follow-up" }).first().click();
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${OUT}/10-home-mobile.png` });
});
