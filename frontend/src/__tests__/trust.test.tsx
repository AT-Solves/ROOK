import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerView } from "@/components/ask";
import { ClaimBadge } from "@/components/trust";
import { NAV } from "@/components/shell";

import { changedAndDo, listAnswer } from "./fixtures";

describe("claim labels (PRD §7)", () => {
  it.each([
    ["FACT", "Fact"],
    ["INFERENCE", "Inference"],
    ["RECOMMENDATION", "Recommendation"],
    ["UNKNOWN", "Unknown"],
  ] as const)("renders %s as visible text with an accessible description", (type, label) => {
    const { container } = render(<ClaimBadge type={type} />);
    const badge = container.querySelector(`[data-claim-type="${type}"]`)!;
    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector(".sr-only")?.textContent).toMatch(/\w+/); // never colour-only
  });
});

describe("Ask ROOK answer (UX §5)", () => {
  it("decomposes a mixed answer into individually typed units, in order (C-008)", () => {
    const { container } = render(<AnswerView a={changedAndDo} />);
    const units = [...container.querySelectorAll("[data-unit-type]")];
    expect(units.map((u) => u.getAttribute("data-unit-type"))).toEqual(["FACT", "INFERENCE", "RECOMMENDATION", "UNKNOWN"]);
    for (const u of units) {
      expect(u.querySelector("[data-claim-type]")).toHaveAttribute("data-claim-type", u.getAttribute("data-unit-type"));
    }
    expect(units[3]).toHaveTextContent("What ROOK cannot establish");
    expect(within(units[2] as HTMLElement).getByRole("button", { name: "Draft follow-up" })).toBeInTheDocument();
    expect(screen.getByText("Sources · 2")).toBeInTheDocument();
  });

  it("never puts one label on the whole composite answer", () => {
    const { container } = render(<AnswerView a={changedAndDo} />);
    const badges = [...container.querySelectorAll("[data-claim-type]")];
    const outside = badges.filter((b) => !b.closest("[data-unit-type]") && !b.closest("details"));
    expect(outside).toEqual([]);
  });

  it("never labels an inference as a fact, and cites no evidence for UNKNOWN", () => {
    const { container } = render(<AnswerView a={changedAndDo} />);
    const why = container.querySelector('[data-unit-type="INFERENCE"]')!;
    expect(why).toHaveTextContent("this may put D-1001 at risk");
    expect(why.querySelector("[data-claim-type]")).toHaveAttribute("data-claim-type", "INFERENCE");
    const unknown = container.querySelector('[data-unit-type="UNKNOWN"]')!;
    expect(unknown).not.toHaveTextContent(/Source ·/);
  });

  it("renders an UNKNOWN single answer without inventing sources", () => {
    render(<AnswerView a={{ ...listAnswer, intent: "search", claim_type: "UNKNOWN", confidence: "low", answer: "I couldn't find enough evidence to answer this confidently.", key_points: [], sources: [] }} />);
    expect(screen.getByText(/couldn't find enough evidence/)).toBeInTheDocument();
    expect(screen.queryByText(/Sources ·/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-claim-type]")).toHaveAttribute("data-claim-type", "UNKNOWN");
  });

  it("shows a single label and key points for single-type answers", () => {
    render(<AnswerView a={listAnswer} />);
    expect(screen.getByRole("heading", { name: "Key points" })).toBeInTheDocument();
    expect(document.querySelector("article [data-claim-type]")).toHaveAttribute("data-claim-type", "FACT");
  });
});

describe("navigation (UX §3, C-003)", () => {
  it("exposes only implemented MVP modules", () => {
    const labels = NAV.map((n) => n.label);
    expect(labels).toEqual(["Home", "Ask ROOK", "Meetings", "Decisions", "Commitments", "Risks", "Context"]);
    for (const hidden of ["Projects", "People", "Briefings", "Settings"]) expect(labels).not.toContain(hidden);
  });
});
