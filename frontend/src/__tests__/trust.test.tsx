import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerView } from "@/components/ask";
import { ClaimBadge } from "@/components/trust";
import { NAV } from "@/components/shell";

import { changedAndDo, claim } from "./fixtures";

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
  it("shows what changed, why it matters, recommended action and sources with their claim types", () => {
    render(<AnswerView a={changedAndDo} />);
    expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended action" })).toBeInTheDocument();
    expect(screen.getByText("Sources · 2")).toBeInTheDocument();
    expect(screen.getByText("high confidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft follow-up" })).toBeInTheDocument();
  });

  it("never labels an inference as a fact", () => {
    const { container } = render(<AnswerView a={changedAndDo} />);
    const why = screen.getByText(/puts D-1001 at risk/).closest("li")!;
    expect(why.querySelector("[data-claim-type]")).toHaveAttribute("data-claim-type", "INFERENCE");
    // the direct answer is an inference too
    expect(container.querySelector("article [data-claim-type]")).toHaveAttribute("data-claim-type", "INFERENCE");
  });

  it("renders an UNKNOWN answer without inventing sources", () => {
    render(
      <AnswerView
        a={{ ...changedAndDo, intent: "search", claim_type: "UNKNOWN", confidence: "low", answer: "I couldn't find enough evidence to answer this confidently.", what_changed: [], why_it_matters: [], recommended_actions: [], key_points: [], sources: [] }}
      />,
    );
    expect(screen.getByText(/couldn't find enough evidence/)).toBeInTheDocument();
    expect(screen.queryByText(/Sources ·/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-claim-type]")).toHaveAttribute("data-claim-type", "UNKNOWN");
  });

  it("shows key points for list answers", () => {
    render(<AnswerView a={{ ...changedAndDo, what_changed: [], why_it_matters: [], key_points: [claim({ text: "Marcus Chen: performance testing" })] }} />);
    expect(screen.getByRole("heading", { name: "Key points" })).toBeInTheDocument();
  });
});

describe("navigation (UX §3, C-003)", () => {
  it("exposes only implemented MVP modules", () => {
    const labels = NAV.map((n) => n.label);
    expect(labels).toEqual(["Home", "Ask ROOK", "Meetings", "Decisions", "Commitments", "Risks", "Sources"]);
    for (const hidden of ["Projects", "People", "Briefings", "Settings"]) expect(labels).not.toContain(hidden);
  });
});
