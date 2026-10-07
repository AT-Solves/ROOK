import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/**
 * The M3 executive workflow (1–9) on the demo tenant, end to end through the real API,
 * finishing with the human-controlled follow-up (MVP success steps 9–11).
 */
test("executive workflow: attention → meeting → evidence → ask → recommended action → approved follow-up", async ({ page }) => {
  await signIn(page);
  const main = page.getByRole("main");

  // 1. What needs attention — insight first, labelled as an inference, with evidence and a recommendation
  const attention = page.getByRole("region", { name: /Needs your attention/ });
  const phoenix = attention.getByRole("listitem").filter({ hasText: "Project Phoenix at risk: dependency delayed" });
  await expect(phoenix.locator("[data-claim-type]").first()).toHaveAttribute("data-claim-type", "INFERENCE");
  await expect(phoenix.getByText(/Evidence · \d+ sources/)).toBeVisible();
  await expect(phoenix.locator('[data-claim-type="RECOMMENDATION"]')).toBeVisible();

  // 2–5. Today's meetings, pending decisions, commitments, risks
  await expect(page.getByRole("region", { name: /^Today/ }).getByRole("link", { name: "Phoenix Product Review" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Decisions pending/ })).toContainText("Approve the Phoenix enterprise pricing tiers");
  await expect(page.getByRole("region", { name: /Your commitments/ })).toContainText("Northwind executive sponsor");
  await expect(page.getByRole("region", { name: /Waiting for/ })).toContainText("Send the updated financial forecast");
  await expect(page.getByRole("region", { name: /At risk/ })).toContainText("Payments Migration");

  // 6. Open a meeting and understand its context
  await page.getByRole("region", { name: /^Today/ }).getByRole("link", { name: "Phoenix Product Review" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Phoenix Product Review" })).toBeVisible();
  await expect(main).toContainText("Preparation suggested");
  for (const section of ["Purpose", "Participants", "Suggested questions", "Related risks", "Related decisions", "Open actions", "Previous context", "Sources"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${section}`) })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: /Suggested questions/ }).locator('[data-claim-type="RECOMMENDATION"]').first()).toBeVisible();

  // 7. Inspect evidence down to the original source
  const risk = page.getByRole("region", { name: /Related risks/ });
  await risk.getByText(/Evidence · \d+ sources/).click();
  await risk.getByRole("link").filter({ hasText: "Message in #platform" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Message in #platform" })).toBeVisible();
  await expect(main).toContainText("Tom Becker");
  await expect(main).toContainText("the API release for Phoenix is delayed");

  // 8. Ask ROOK
  await page.getByRole("link", { name: "Ask ROOK" }).click();
  await page.getByLabel("Ask ROOK a question").fill("What changed and what should I do?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.getByRole("article");
  await expect(answer.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(answer.getByRole("heading", { name: "Why it matters" })).toBeVisible();
  await expect(answer.getByText(/confidence/).first()).toBeVisible();
  await expect(answer.getByText(/Sources · \d+/)).toBeVisible();

  // 9. What action ROOK recommends → draft → explicit approval
  const rec = answer.getByRole("region", { name: "Recommended action" });
  await expect(rec).toContainText("Ask Marcus for a recovery plan");
  await rec.getByRole("button", { name: "Draft follow-up" }).first().click();
  const draft = page.getByRole("region", { name: "Follow up with Marcus Chen" });
  await expect(draft).toContainText("Nothing is sent until you approve");
  await expect(draft.getByLabel("Message")).toHaveValue(/recovery plan/);
  await expect(draft).toContainText("Why ROOK suggests this");
  await draft.getByRole("button", { name: "Approve and send" }).click();
  await expect(draft.getByRole("status")).toContainText("Sent.");
  await expect(draft.getByRole("status")).toContainText("demo outbox");
});

test("decision, commitment and risk details show provenance and related context", async ({ page }) => {
  await signIn(page);
  await page.goto("/decisions?tab=made");
  await page.getByRole("link", { name: "Launch Project Phoenix on October 18" }).click();
  for (const label of ["Status", "Date", "Decision owner", "Context", "Why", "Participants"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Customer contractual commitment with Northwind");
  await expect(page.getByRole("region", { name: /Related actions/ })).toContainText("performance testing");

  await page.getByRole("region", { name: /Related actions/ }).getByRole("link").first().click();
  await expect(page.getByText("Related decision", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("D-1001");
  await expect(page.getByRole("region", { name: /Follow-up options/ })).toBeVisible();

  await page.getByRole("link", { name: "Risks" }).click();
  await page.getByRole("link", { name: "Payments Migration: discussed repeatedly without a decision" }).click();
  await expect(page.getByText("Why ROOK detected it")).toBeVisible();
  await expect(page.getByRole("region", { name: "Suggested next step" }).locator('[data-claim-type="RECOMMENDATION"]')).toBeVisible();
  // severity is a word; there is no numeric AI score anywhere on the visible page (UX §9)
  expect(await page.getByRole("main").innerText()).not.toMatch(/\bscore\s*[:=]?\s*\d|\b\d{1,3}\s*%/i);
});

test("inferred actions are suggestions, never presented as facts", async ({ page }) => {
  await signIn(page);
  await page.goto("/commitments?tab=proposed");
  const items = page.locator("main li").filter({ hasText: "ROOK inferred this action" });
  await expect(items.first()).toBeVisible();
  for (const badge of await items.locator("[data-claim-type]").all()) {
    await expect(badge).toHaveAttribute("data-claim-type", "INFERENCE");
  }
});
