import type { AskAnswer, Claim, EvidenceRef } from "@/lib/types";

export const ev = (id = 1, over: Partial<EvidenceRef> = {}): EvidenceRef => ({
  signal_id: id, kind: "email", channel: "Outlook", title: `Source ${id}`, author: "Marcus Chen",
  occurred_at: "2026-10-04T17:00:00Z", quote: "Engineering will complete testing by October 8.", note: "",
  url: "", authority: 0.6, ...over,
});

export const claim = (over: Partial<Claim> = {}): Claim => ({
  text: "A claim", claim_type: "FACT", confidence: "high", evidence: [ev()], basis: "", detail: "", meta: "", ...over,
});

const fact = claim({ text: "Slack #platform · Tom Becker: Heads up: the API release for Phoenix is delayed", evidence: [ev(7, { channel: "Slack #platform" })] });
const inference = claim({ text: "Project Phoenix at risk: dependency delayed — this may put D-1001 at risk", claim_type: "INFERENCE", confidence: "high", evidence: [ev(7), ev(8)] });
const recommendation = claim({ text: "Ask Marcus for a recovery plan.", claim_type: "RECOMMENDATION", action: { type: "draft_followup", commitment_id: 3, risk_id: 2 } });
const unknown = claim({ text: "ROOK cannot determine from available evidence whether D-1001 will change.", claim_type: "UNKNOWN", confidence: "low", evidence: [], basis: "No accessible source states a change to this decision." });

/** Mirrors the API's composite answer to "What changed and what should I do?" (C-008). */
export const changedAndDo: AskAnswer = {
  question: "What changed and what should I do?",
  intent: "changed_and_do",
  engine: "structured",
  answer: "Here is what changed, why it may matter, what ROOK recommends, and what it cannot establish.",
  claim_type: null,
  confidence: null,
  composite: true,
  units: [fact, inference, recommendation, unknown],
  what_changed: [fact],
  why_it_matters: [inference],
  key_points: [],
  recommended_actions: [recommendation],
  unknowns: [unknown],
  sections: [],
  sources: [ev(7), ev(8)],
};

/** A single-type answer (e.g. "What am I waiting for?"). */
export const listAnswer: AskAnswer = {
  ...changedAndDo,
  intent: "waiting_for",
  answer: "You are waiting on 1 commitment(s) from others.",
  claim_type: "FACT",
  confidence: "high",
  composite: false,
  units: [],
  what_changed: [],
  why_it_matters: [],
  recommended_actions: [],
  unknowns: [],
  key_points: [claim({ text: "Marcus Chen: performance testing" })],
};
