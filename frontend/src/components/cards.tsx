import type { ReactNode } from "react";

import { formatDate } from "@/lib/format";
import type { Commitment, Decision, Risk } from "@/lib/types";

import { RecommendationBlock } from "./actions";
import { Icon, type IconName } from "./icons";
import { InsightCard } from "./insight";
import { ClaimBadge, LevelPill, StatusText } from "./trust";

/** Compact metadata item: small gold-accented icon + text. */
export function Meta({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} size={14} accent className="text-chess" />
      {children}
    </span>
  );
}

export function CommitmentCard({ c, showAction = false }: { c: Commitment; showAction?: boolean }) {
  return (
    <InsightCard
      title={c.description}
      href={`/commitments/${c.id}`}
      claimType={c.claim_type}
      confidence={c.confidence}
      meta={
        <>
          <Meta icon="person">{c.mine ? "You" : c.owner}</Meta>
          <Meta icon="clock">Due {c.due_date ? formatDate(c.due_date) : "not stated"}</Meta>
          <StatusText status={c.status} />
          {c.status === "overdue" ? <ClaimBadge type={c.status_claim_type} /> : null}
          {c.project ? <Meta icon="briefcase">{c.project}</Meta> : null}
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
          <span className="rounded-[4px] bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">{d.code}</span>
          <StatusText status={d.status} />
          <Meta icon="person">{d.status === "pending" ? `Awaiting ${d.needs_me ? "you" : d.owner || "a decision owner"}` : `By ${d.owner || "unknown"}`}</Meta>
          <Meta icon="calendar">{formatDate(d.decided_at)}</Meta>
          {d.project ? <Meta icon="briefcase">{d.project}</Meta> : null}
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
          {r.project ? <Meta icon="briefcase">{r.project}</Meta> : null}
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
