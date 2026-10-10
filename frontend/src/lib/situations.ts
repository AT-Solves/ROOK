/**
 * Home presentation layer (docs/design/ROOK_HOME_UX_SPEC.md): turns the brief's registers into *situations*.
 *
 * Rules that protect ROOK's provenance model:
 *  • A situation is formed only from relationships the API states explicitly: a risk's related decisions/commitments,
 *    a commitment's related decision, a decision's related commitments. Sharing a project is shown as context but
 *    never merges records — without a stated relationship, records stay separate.
 *  • Only records present in permission-filtered responses are used. Raw ids that do not resolve to a visible record
 *    (e.g. `risk.related` ids) are ignored: never counted, never shown.
 *  • Nothing here writes text that makes a claim. Every line shown carries the claim type the API gave it.
 * Ranking is a presentation-order heuristic only — never displayed, and not a score of the business situation.
 */
import type { AttentionItem, Brief, ChangeItem, Commitment, Confidence, Decision, EvidenceRef, Level, Meeting, RecommendedAction, Risk } from "./types";

export type RecordKey = `risk:${number}` | `decision:${number}` | `commitment:${number}`;

export interface Situation {
  key: string;
  title: string;
  /** Existing project label, shown as context only. */
  context: string | null;
  lead: { kind: "risk"; record: Risk } | { kind: "decision"; record: Decision } | { kind: "commitment"; record: Commitment };
  attention: AttentionItem[];
  risks: Risk[];
  decisions: Decision[];
  commitments: Commitment[];
  /** Source facts (brief changes) whose signal is cited as evidence by a record in this situation. */
  facts: ChangeItem[];
  recommendation: RecommendedAction | null;
  level: Level;
  confidence: Confidence;
  evidenceCount: number;
  rank: number;
}

const LEVEL_WEIGHT: Record<Level, number> = { high: 3, medium: 2, low: 1 };
const ACTIONABLE = new Set(["draft_followup", "prepare_meeting", "decide", "review_decision"]);

export function hrefFor(key: RecordKey): string {
  const [kind, id] = key.split(":");
  return `/${kind === "risk" ? "risks" : kind === "decision" ? "decisions" : "commitments"}/${id}`;
}

function isActionable(rec: RecommendedAction | null | undefined): boolean {
  return !!rec && "type" in rec.action && ACTIONABLE.has(rec.action.type);
}

/** Union-find over explicit relationships between visible records. */
class Groups {
  private parent = new Map<string, string>();
  add(k: string) {
    if (!this.parent.has(k)) this.parent.set(k, k);
  }
  find(k: string): string {
    const p = this.parent.get(k)!;
    if (p === k) return k;
    const root = this.find(p);
    this.parent.set(k, root);
    return root;
  }
  union(a: string, b: string) {
    if (!this.parent.has(a) || !this.parent.has(b)) return; // never link to a record the user cannot see
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
  keys() {
    return [...this.parent.keys()];
  }
}

/** Build situations from the brief. Records appear in exactly one situation (duplicate suppression). */
export function buildSituations(b: Brief): Situation[] {
  const risks = new Map<string, Risk>(b.risks.map((r) => [`risk:${r.id}`, r]));
  const decisions = new Map<string, Decision>(b.decisions_pending.map((d) => [`decision:${d.id}`, d]));
  const commitments = new Map<string, Commitment>([...b.waiting_for, ...b.my_commitments].map((c) => [`commitment:${c.id}`, c]));

  const g = new Groups();
  [...risks.keys(), ...decisions.keys(), ...commitments.keys()].forEach((k) => g.add(k));
  for (const [k, r] of risks) {
    r.related?.decisions?.forEach((id) => g.union(k, `decision:${id}`));
    r.related?.commitments?.forEach((id) => g.union(k, `commitment:${id}`));
  }
  for (const [k, c] of commitments) if (c.related_decision) g.union(k, `decision:${c.related_decision.id}`);
  for (const [k, d] of decisions) d.related_commitments?.forEach((c) => g.union(k, `commitment:${c.id}`));

  const members = new Map<string, string[]>();
  for (const k of g.keys()) {
    const root = g.find(k);
    members.set(root, [...(members.get(root) ?? []), k]);
  }

  const attentionByKey = new Map<string, AttentionItem>(b.attention.map((a) => [`${a.type}:${a.id}`, a]));
  const attentionOrder = new Map<string, number>(b.attention.map((a, i) => [`${a.type}:${a.id}`, i]));

  const out: Situation[] = [];
  for (const keys of members.values()) {
    const sr = keys.filter((k) => k.startsWith("risk:")).map((k) => risks.get(k)!);
    const sd = keys.filter((k) => k.startsWith("decision:")).map((k) => decisions.get(k)!);
    const sc = keys.filter((k) => k.startsWith("commitment:")).map((k) => commitments.get(k)!);
    const attention = keys
      .filter((k) => attentionByKey.has(k))
      .sort((a, c) => attentionOrder.get(a)! - attentionOrder.get(c)!)
      .map((k) => attentionByKey.get(k)!);
    // Lead: the situation's first attention item (ROOK's order), else its most severe risk, else a decision, else a commitment.
    const leadKey = attention[0] ? `${attention[0].type}:${attention[0].id}` : sr[0] ? `risk:${sr[0].id}` : sd[0] ? `decision:${sd[0].id}` : `commitment:${sc[0].id}`;
    const lead: Situation["lead"] = leadKey.startsWith("risk:")
      ? { kind: "risk", record: risks.get(leadKey)! }
      : leadKey.startsWith("decision:")
        ? { kind: "decision", record: decisions.get(leadKey)! }
        : { kind: "commitment", record: commitments.get(leadKey)! };

    const cited = new Set([...sr, ...sd, ...sc].flatMap((x) => x.evidence.map((e) => e.signal_id)));
    const facts = b.changes.filter((c) => cited.has(c.signal_id));
    const recommendation = attention.find((a) => a.recommended_action)?.recommended_action ?? sr.find((r) => r.recommended_action)?.recommended_action ?? null;
    const levels = [...attention.map((a) => a.level), ...sr.map((r) => r.level)];
    const level = levels.sort((x, y) => LEVEL_WEIGHT[y] - LEVEL_WEIGHT[x])[0] ?? "low";
    const confidence = attention[0]?.confidence ?? lead.record.confidence;
    const evidence = new Set([...sr, ...sd, ...sc].flatMap((x) => x.evidence.map((e) => e.signal_id)));
    const rank =
      LEVEL_WEIGHT[level] * 2 +
      Math.min(4, keys.length) +
      (isActionable(recommendation) ? 1 : 0) +
      (sd.some((d) => d.status === "pending") ? 1 : 0) +
      (confidence === "high" ? 1 : 0);

    out.push({
      key: leadKey,
      title: lead.kind === "risk" ? lead.record.title : lead.kind === "decision" ? lead.record.statement : lead.record.description,
      context: lead.record.project ?? null,
      lead,
      attention,
      risks: sr,
      decisions: sd,
      commitments: sc,
      facts,
      recommendation,
      level,
      confidence,
      evidenceCount: evidence.size,
      rank,
    });
  }
  // Highest rank first; ties keep ROOK's attention order, then the lead's place in its register.
  const firstSeen = (s: Situation) => Math.min(...[s.key, ...s.attention.map((a) => `${a.type}:${a.id}`)].map((k) => attentionOrder.get(k) ?? 99));
  return out.sort((a, c) => c.rank - a.rank || firstSeen(a) - firstSeen(c));
}

/** The one situation that needs judgment: the top-ranked situation that has an attention item. */
export function primarySituation(situations: Situation[]): Situation | null {
  return situations.find((s) => s.attention.length > 0) ?? null;
}

export function situationOf(situations: Situation[], key: string): Situation | undefined {
  return situations.find((s) => s.key === key || s.attention.some((a) => `${a.type}:${a.id}` === key) ||
    s.risks.some((r) => `risk:${r.id}` === key) || s.decisions.some((d) => `decision:${d.id}` === key) || s.commitments.some((c) => `commitment:${c.id}` === key));
}

/* ---------------------------------------------------------------- next moves */

export interface NextMove {
  key: string;
  /** What to consider doing (the API's recommendation, or the user's own commitment). */
  text: string;
  /** Why it is here (the brief's attention label, e.g. "Risk detected"). */
  reason: string;
  claimType: AttentionItem["claim_type"] | "RECOMMENDATION";
  recommendation: RecommendedAction | null;
  href: string;
  situation: string;
  riskId?: number;
}

/** One move per attention item, in ROOK's order. Each keeps the claim type the API gave it. */
export function nextMoves(b: Brief, situations: Situation[], limit = 5): NextMove[] {
  return b.attention.slice(0, limit).map((a) => {
    const key = `${a.type}:${a.id}`;
    const s = situationOf(situations, key);
    const rec = a.recommended_action;
    return {
      key,
      text: rec ? firstSentence(rec.text) : a.title,
      reason: a.label,
      claimType: rec ? "RECOMMENDATION" : a.claim_type,
      recommendation: rec,
      href: hrefFor(key as RecordKey),
      situation: s?.context ?? s?.title ?? a.title,
      riskId: a.type === "risk" ? a.id : undefined,
    };
  });
}

/** Keep a recommendation to its first sentence on Home; the full text stays one click away. */
export function firstSentence(text: string): string {
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : text;
}

/* ---------------------------------------------------------------- watch */

export type WatchStatus = { label: "Needs intervention"; tone: "risk" } | { label: "Monitor"; tone: "warn" } | { label: "Awaiting response"; tone: "neutral" };

export interface WatchItem {
  key: string;
  title: string;
  context: string | null;
  detail: string;
  status: WatchStatus;
  href: string;
}

/**
 * What ROOK is monitoring: one row per situation with an open risk or a commitment someone owes the user.
 * Status words are derived only from existing fields; there is deliberately no positive ("on track") status,
 * because the API has nothing that supports it.
 */
export function watchItems(situations: Situation[]): WatchItem[] {
  const items: WatchItem[] = [];
  for (const s of situations) {
    const openRisks = s.risks.filter((r) => r.status === "open");
    const owed = s.commitments.filter((c) => !c.mine && (c.status === "open" || c.status === "overdue"));
    if (!openRisks.length && !owed.length) continue;
    const top = openRisks[0];
    let status: WatchStatus;
    if (top && top.level === "high" && top.recommended_action) status = { label: "Needs intervention", tone: "risk" };
    else if (top || owed.some((c) => c.status === "overdue")) status = { label: "Monitor", tone: "warn" };
    else status = { label: "Awaiting response", tone: "neutral" };
    const lead = top ?? owed[0];
    items.push({
      key: s.key,
      title: s.context ?? s.title,
      context: s.context ? s.title : null,
      detail: top ? RULE_LABEL[top.rule] ?? "Risk detected" : `${owed[0].owner}: ${owed[0].status === "overdue" ? "overdue" : "open"}`,
      status,
      href: top ? `/risks/${top.id}` : `/commitments/${lead.id}`,
    });
  }
  return items;
}

/** The risk rules ROOK runs, in words (backend rook/services/risk.py). */
export const RULE_LABEL: Record<string, string> = {
  dependency_delay: "Dependency delayed",
  overdue_commitment: "Commitment overdue",
  unresolved_discussion: "Discussed without a decision",
  unowned_escalation: "Escalation without an owner",
};

/* ---------------------------------------------------------------- today's moves */

export function upcomingToday(today: Meeting[]): { upcoming: Meeting[]; earlier: Meeting[] } {
  return { upcoming: today.filter((m) => !m.past), earlier: today.filter((m) => m.past) };
}

/* ---------------------------------------------------------------- dependency signals */

/** Evidence the risk rules cite as a delay signal (e.g. a chat message or a work-item status change). */
export function dependencySignals(evidence: EvidenceRef[]): EvidenceRef[] {
  return evidence.filter((e) => /delay signal/i.test(e.note));
}
