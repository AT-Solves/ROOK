import { formatDate } from "@/lib/format";
import type { Commitment, Decision, Risk } from "@/lib/types";

import { RecommendationBlock } from "./actions";
import { InsightCard } from "./insight";
import { ClaimBadge, LevelPill, StatusText } from "./trust";

export function CommitmentCard({ c, showAction = false }: { c: Commitment; showAction?: boolean }) {
  return (
    <InsightCard
      title={c.description}
      href={`/commitments/${c.id}`}
      claimType={c.claim_type}
      confidence={c.confidence}
      meta={
        <>
          <span>{c.mine ? "You" : c.owner}</span>
          <span>Due {c.due_date ? formatDate(c.due_date) : "not stated"}</span>
          <StatusText status={c.status} />
          {c.status === "overdue" ? <ClaimBadge type={c.status_claim_type} /> : null}
          {c.project ? <span>{c.project}</span> : null}
        </>
      }
      why={c.status === "overdue" ? c.status_basis : c.kind === "inferred" ? "ROOK inferred this action; it needs an owner before it is tracked." : undefined}
      evidence={c.evidence}
    >
      {showAction && c.status === "overdue" && !c.mine ? (
        <RecommendationBlock
          rec={{ text: `Follow up with ${c.owner.split(" ")[0]}; ROOK can draft it for your approval.`, claim_type: "RECOMMENDATION", action: { type: "draft_followup", commitment_id: c.id } }}
        />
      ) : null}
    </InsightCard>
  );
}

export function DecisionCard({ d }: { d: Decision }) {
  return (
    <InsightCard
      title={d.statement}
      href={`/decisions/${d.id}`}
      claimType={d.claim_type}
      confidence={d.confidence}
      meta={
        <>
          <span className="font-mono">{d.code}</span>
          <StatusText status={d.status} />
          <span>{d.status === "pending" ? `Awaiting ${d.needs_me ? "you" : d.owner || "a decision owner"}` : `By ${d.owner || "unknown"}`}</span>
          <span>{formatDate(d.decided_at)}</span>
          {d.project ? <span>{d.project}</span> : null}
        </>
      }
      evidence={d.evidence}
    />
  );
}

export function RiskCard({ r, withAction = true }: { r: Risk; withAction?: boolean }) {
  return (
    <InsightCard
      title={r.title}
      href={`/risks/${r.id}`}
      claimType={r.claim_type}
      confidence={r.confidence}
      meta={
        <>
          <LevelPill level={r.level} />
          {r.project ? <span>{r.project}</span> : null}
          {r.status !== "open" ? <StatusText status={r.status} /> : null}
        </>
      }
      why={r.explanation}
      evidence={r.evidence}
    >
      {withAction ? <RecommendationBlock rec={r.recommended_action} riskId={r.id} /> : null}
    </InsightCard>
  );
}
