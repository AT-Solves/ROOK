import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RookJudgmentCard } from "@/components/home/situation";
import { RookExecutivePulse } from "@/components/home/header";
import { buildSituations, primarySituation } from "@/lib/situations";
import { setToken } from "@/lib/session";
import type { Brief } from "@/lib/types";

import demo from "./brief.fixture.json";
import { changedAndDo } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const brief = () => structuredClone(demo) as unknown as Brief;

/** Routes API calls by path; records every request so tests can prove what Home did (and did not) call. */
function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const b = brief();
    const riskDetail = { ...b.risks[0], related_decisions: [{ ...b.decisions_pending[0], id: 1, code: "D-1001", status: "made" }], related_commitments: [] };
    const body = /\/api\/ask$/.test(url) ? changedAndDo : /\/api\/risks\/\d+$/.test(url) ? riskDetail : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

const asked = (f: ReturnType<typeof mockApi>) => f.mock.calls.filter(([u]) => /\/api\/ask$/.test(String(u)));

describe("One thing needs your judgment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setToken("tok");
  });

  it("shows the primary situation with separately labelled claims, evidence and a recommendation", async () => {
    mockApi();
    render(<RookJudgmentCard s={primarySituation(buildSituations(brief()))} />);
    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { name: "Project Phoenix at risk: dependency delayed" })).toBeInTheDocument();
    const types = Array.from(card.querySelectorAll("[data-claim-type]")).map((e) => e.getAttribute("data-claim-type"));
    expect(types).toEqual(expect.arrayContaining(["INFERENCE", "FACT", "RECOMMENDATION"]));
    expect(within(card).getByText(/^Evidence · \d+ sources?$/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Draft follow-up" })).toBeInTheDocument();
    // connected context arrives with the (permission-filtered) risk detail, after first paint
    await waitFor(() => expect(within(card).getByRole("link", { name: /^D-1001 · / })).toHaveAttribute("href", "/decisions/1"));
  });

  it("never calls Ask ROOK on its own; See full briefing calls it once, on request", async () => {
    const f = mockApi();
    render(<RookJudgmentCard s={primarySituation(buildSituations(brief()))} />);
    await waitFor(() => expect(f).toHaveBeenCalled()); // the risk detail loads
    expect(asked(f)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "See full briefing" }));
    await waitFor(() => expect(document.querySelectorAll("[data-unit-type]")).toHaveLength(4));
    expect(asked(f)).toHaveLength(1);
    expect(Array.from(document.querySelectorAll("[data-unit-type]")).map((e) => e.getAttribute("data-unit-type"))).toEqual(["FACT", "INFERENCE", "RECOMMENDATION", "UNKNOWN"]);
  });

  it("expands the situation in place with links to existing detail pages", async () => {
    mockApi();
    render(<RookJudgmentCard s={primarySituation(buildSituations(brief()))} />);
    const toggle = screen.getByRole("button", { name: "See situation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide situation" })).toHaveAttribute("aria-expanded", "true");
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links.some((h) => /^\/commitments\/\d+$/.test(h ?? ""))).toBe(true);
    expect(links.some((h) => /^\/evidence\/\d+$/.test(h ?? ""))).toBe(true);
  });

  it("is calm when nothing needs judgment", () => {
    render(<RookJudgmentCard s={null} />);
    expect(screen.getByText("ROOK sees no immediate situation requiring your judgment.")).toBeInTheDocument();
  });
});

describe("Executive pulse", () => {
  it("is navigation: each count is a link with a full accessible name", () => {
    render(
      <RookExecutivePulse
        items={[
          { value: 6, label: "Attention", name: "6 items need your attention", href: "#h-moves", icon: "target" },
          { value: 1, label: "Decision", name: "1 decision pending", href: "/decisions?tab=pending", icon: "document" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Executive pulse" });
    expect(within(nav).getByRole("link", { name: "6 items need your attention" })).toHaveAttribute("href", "#h-moves");
    expect(within(nav).getByRole("link", { name: "1 decision pending" })).toHaveAttribute("href", "/decisions?tab=pending");
  });
});
