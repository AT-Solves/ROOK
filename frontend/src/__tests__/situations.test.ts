import { describe, expect, it } from "vitest";

import { buildSituations, firstSentence, nextMoves, primarySituation, watchItems } from "@/lib/situations";
import type { Brief } from "@/lib/types";

import demo from "./brief.fixture.json";

const brief = () => structuredClone(demo) as unknown as Brief;
const keysOf = (b: Brief) =>
  buildSituations(b).map((s) => [...s.risks.map((r) => `risk:${r.id}`), ...s.decisions.map((d) => `decision:${d.id}`), ...s.commitments.map((c) => `commitment:${c.id}`)].sort());

describe("situations (Home view model)", () => {
  it("groups only explicitly related records: the Phoenix risk with Marcus's commitment, not the pricing decision", () => {
    const b = brief();
    const phoenix = buildSituations(b).find((s) => s.risks.some((r) => r.rule === "dependency_delay"))!;
    expect(phoenix.commitments.map((c) => c.owner)).toEqual(["Marcus Chen"]);
    // D-1002 shares the project but has no stated relationship with the risk: it stays its own situation.
    expect(phoenix.decisions).toEqual([]);
    expect(phoenix.context).toBe("Project Phoenix");
  });

  it("never merges records just because they share a project", () => {
    const b = brief();
    b.risks.forEach((r) => (r.related = {}));
    b.waiting_for.forEach((c) => (c.related_decision = null));
    b.decisions_pending.forEach((d) => (d.related_commitments = []));
    const sizes = keysOf(b).map((k) => k.length);
    expect(sizes.every((n) => n === 1)).toBe(true);
  });

  it("shows each record in exactly one situation (duplicate suppression)", () => {
    const all = keysOf(brief()).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("ignores related ids the user cannot see — they are neither counted nor shown", () => {
    const b = brief();
    const risk = b.risks.find((r) => r.rule === "dependency_delay")!;
    risk.related = { commitments: [...(risk.related.commitments ?? []), 9999], decisions: [...(risk.related.decisions ?? []), 8888] };
    const s = buildSituations(b).find((x) => x.risks.includes(risk))!;
    expect(s.commitments.map((c) => c.id)).not.toContain(9999);
    expect(s.decisions.map((d) => d.id)).not.toContain(8888);
  });

  it("picks the most consequential actionable situation for judgment, without hard-coding it", () => {
    const top = primarySituation(buildSituations(brief()))!;
    expect(top.title).toBe("Project Phoenix at risk: dependency delayed");
    // remove the Phoenix risk: a different situation leads, and nothing breaks
    const b = brief();
    b.risks = b.risks.filter((r) => r.rule !== "dependency_delay");
    b.attention = b.attention.filter((a) => !(a.type === "risk" && a.title.startsWith("Project Phoenix")));
    expect(primarySituation(buildSituations(b))!.title).not.toMatch(/Phoenix at risk/);
  });

  it("links source facts to a situation only through cited evidence", () => {
    const top = primarySituation(buildSituations(brief()))!;
    expect(top.facts.length).toBeGreaterThan(0);
    expect(top.facts.every((f) => f.claim_type === "FACT")).toBe(true);
    const cited = new Set(top.risks.flatMap((r) => r.evidence.map((e) => e.signal_id)).concat(top.commitments.flatMap((c) => c.evidence.map((e) => e.signal_id))));
    expect(top.facts.every((f) => cited.has(f.signal_id))).toBe(true);
  });

  it("has no situation for judgment when nothing needs attention", () => {
    const b = brief();
    b.attention = [];
    expect(primarySituation(buildSituations(b))).toBeNull();
  });
});

describe("next moves", () => {
  it("lists ROOK's moves in order, keeping each item's claim type, reason and situation", () => {
    const b = brief();
    const moves = nextMoves(b, buildSituations(b), 6);
    expect(moves).toHaveLength(b.attention.length);
    expect(moves[0]).toMatchObject({ claimType: "RECOMMENDATION", reason: "Risk detected", situation: "Project Phoenix" });
    expect(moves[0].text).toBe("Ask Marcus for a recovery plan that protects D-1001 (Launch Project Phoenix on October 21) and a confirmed date for the platform team's API release.");
    // your own commitment has no recommendation: it stays a FACT
    expect(moves.find((m) => m.reason === "Your commitment")).toMatchObject({ claimType: "FACT" });
  });

  it("keeps only the first sentence of a recommendation on Home", () => {
    expect(firstSentence("Ask Marcus. ROOK can draft it.")).toBe("Ask Marcus.");
    expect(firstSentence("No period here")).toBe("No period here");
  });
});

describe("watch", () => {
  it("states what ROOK monitors in words and never claims a positive status", () => {
    const items = watchItems(buildSituations(brief()));
    expect(items.map((w) => w.status.label)).toEqual(expect.arrayContaining(["Needs intervention", "Monitor"]));
    expect(items.some((w) => /on track/i.test(w.status.label))).toBe(false);
    expect(items.find((w) => w.title === "Project Phoenix")).toMatchObject({ detail: "Dependency delayed", href: expect.stringMatching(/^\/risks\/\d+$/) });
  });

  it("marks commitments others owe you as awaiting response when no risk is open", () => {
    const b = brief();
    b.risks = [];
    b.attention = [];
    const items = watchItems(buildSituations(b));
    expect(items.find((w) => w.detail.startsWith("Marcus Chen"))?.status.label).toBe("Awaiting response");
  });
});
