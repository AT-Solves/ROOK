import type { AskAnswer, Claim, EvidenceRef } from "@/lib/types";

export const ev = (id = 1, over: Partial<EvidenceRef> = {}): EvidenceRef => ({
  signal_id: id, kind: "email", channel: "Outlook", title: `Source ${id}`, author: "Marcus Chen",
  occurred_at: "2026-10-04T17:00:00Z", quote: "Engineering will complete testing by October 8.", note: "",
  url: "", authority: 0.6, ...over,
});

export const claim = (over: Partial<Claim> = {}): Claim => ({
  text: "A claim", claim_type: "FACT", confidence: "high", evidence: [ev()], basis: "", detail: "", meta: "", ...over,
});

export const changedAndDo: AskAnswer = {
  question: "What changed and what should I do?",
  intent: "changed_and_do",
  engine: "structured",
  answer: "Most important change: the API release for Phoenix is delayed. Why it matters: Project Phoenix at risk. Recommended: Ask Marcus for a recovery plan.",
  claim_type: "INFERENCE",
  confidence: "high",
  what_changed: [claim({ text: "Slack #platform · Tom Becker: Heads up: the API release for Phoenix is delayed", evidence: [ev(7, { channel: "Slack #platform" })] })],
  why_it_matters: [claim({ text: "Project Phoenix at risk: dependency delayed — puts D-1001 at risk", claim_type: "INFERENCE", evidence: [ev(7), ev(8)] })],
  key_points: [],
  recommended_actions: [claim({ text: "Ask Marcus for a recovery plan.", claim_type: "RECOMMENDATION", action: { type: "draft_followup", commitment_id: 3 } })],
  sections: [],
  sources: [ev(7), ev(8)],
};
