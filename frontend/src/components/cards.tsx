import { formatDate } from "@/lib/format";
import type { Commitment, Decision, Level, Risk } from "@/lib/types";

import { RecommendationBlock } from "./actions";
import { EvidenceList } from "./evidence";
import { RookInsightCard, RookMeta } from "./rook";
import { ClaimBadge, ConfidenceLabel, LevelPill, StatusText } from "./trust";

export { RookMeta as Meta };

export const LEVEL_ACCENT: Record<Level, "risk" | "warn" | "none"> = { high: "risk", medium: "warn", low: "none" };

export function CommitmentCard({ c, showAction = false }: { c: Commitment; showAction?: boolean }) {
  const followUp = showAction && c.status === "overdue" && !c.mine;
  return (
    <RookInsightCard
      label={<ClaimBadge type={c.claim_type} />}
      title={c.description}
      href={`/commitments/${c.id}`}
      accent={c.status === "overdue" ? "warn" : "none"}
      signals={
        <>
          <StatusText status={c.status} />
          {c.status === "overdue" ? <ClaimBadge type={c.status_claim_type} /> : null}
          <RookMeta icon="person">{c.mine ? "You" : c.owner}</RookMeta>
          <RookMeta icon="clock">Due {c.due_date ? formatDate(c.due_date) : "not stated"}</RookMeta>
          {c.project ? <RookMeta icon="briefcase">{c.project}</RookMeta> : null}
          <ConfidenceLabel value={c.confidence} />
        </>
      }
      summary={c.status === "overdue" ? c.status_basis : c.kind === "inferred" ? "ROOK inferred this action; it needs an owner before it is tracked." : undefined}
      evidence={<EvidenceList evidence={c.evidence} />}
      action={
        followUp ? (
          <RecommendationBlock
            bare
            rec={{ text: `Follow up with ${c.owner.split(" ")[0]}; ROOK can draft it for your approval.`, claim_type: "RECOMMENDATION", action: { type: "draft_followup", commitment_id: c.id } }}
          />
        ) : undefined
      }
    />
  );
}

export function DecisionCard({ d }: { d: Decision }) {
  return (
    <RookInsightCard
      label={
        <>
          <ClaimBadge type={d.claim_type} />
          <span className="font-mono text-[11px] font-medium text-muted">{d.code}</span>
        </>
      }
      title={d.statement}
      href={`/decisions/${d.id}`}
      signals={
        <>
          <StatusText status={d.status} />
          <RookMeta icon="person">{d.status === "pending" ? `Awaiting ${d.needs_me ? "you" : d.owner || "a decision owner"}` : `By ${d.owner || "unknown"}`}</RookMeta>
          <RookMeta icon="calendar">{formatDate(d.decided_at)}</RookMeta>
          {d.project ? <RookMeta icon="briefcase">{d.project}</RookMeta> : null}
          <ConfidenceLabel value={d.confidence} />
        </>
      }
      evidence={<EvidenceList evidence={d.evidence} />}
    />
  );
}

export function RiskCard({ r, withAction = true }: { r: Risk; withAction?: boolean }) {
  return (
    <RookInsightCard
      label={<ClaimBadge type={r.claim_type} />}
      title={r.title}
      href={`/risks/${r.id}`}
      accent={LEVEL_ACCENT[r.level]}
      signals={
        <>
          <LevelPill level={r.level} />
          <ConfidenceLabel value={r.confidence} />
          {r.project ? <RookMeta icon="briefcase">{r.project}</RookMeta> : null}
          {r.status !== "open" ? <StatusText status={r.status} /> : null}
        </>
      }
      summary={r.explanation}
      why={r.basis}
      evidence={<EvidenceList evidence={r.evidence} />}
      action={withAction && r.recommended_action ? <RecommendationBlock bare rec={r.recommended_action} riskId={r.id} /> : undefined}
    />
  );
}
