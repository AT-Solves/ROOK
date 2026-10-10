import Link from "next/link";

import type { ActionRef, Claim, RecommendedAction } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { FollowupLauncher } from "./followup";
import { RookButtonLink } from "./rook";
import { ClaimBadge } from "./trust";

/**
 * Action comes third (UX §17). Each recommendation maps to a real capability; where ROOK has no capability yet
 * (e.g. assigning an owner in a source system) it says so instead of pretending.
 */
export function ActionControl({ action, riskId }: { action?: ActionRef | Record<string, never> | null; riskId?: number }) {
  if (!action || !("type" in action)) return null;
  switch (action.type) {
    case "draft_followup":
      return <FollowupLauncher commitmentId={action.commitment_id} riskId={action.risk_id ?? riskId} />;
    case "prepare_meeting":
      return (
        <RookButtonLink href={`/meetings/${action.meeting_id}`} variant="secondary" icon="calendar">
          Open meeting preparation
        </RookButtonLink>
      );
    case "decide":
    case "review_decision":
      return (
        <RookButtonLink href={`/decisions/${action.decision_id}`} variant="secondary" icon="flag">
          Review the decision
        </RookButtonLink>
      );
    case "assign_owner":
      return (
        <span className="text-[12px] text-muted">
          ROOK can&apos;t assign owners in your systems yet; handle this directly.{" "}
          <Link className="font-semibold text-midnight underline underline-offset-2" href={`/evidence/${action.signal_id}`}>
            View source
          </Link>
        </span>
      );
    default:
      return null;
  }
}

/** A recommendation: gold edge, the label, one sentence, and the action it maps to. */
export function RecommendationBlock({ rec, riskId, bare = false }: { rec: RecommendedAction | null; riskId?: number; bare?: boolean }) {
  if (!rec) return null;
  return (
    <div className={bare ? "" : "mt-4 border-t border-line pt-4"}>
      <div className="border-l-2 border-gold pl-3.5">
        <ClaimBadge type="RECOMMENDATION" />
        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-midnight">{rec.text}</p>
        <div className="mt-3">
          <ActionControl action={rec.action} riskId={riskId} />
        </div>
      </div>
    </div>
  );
}

export function RecommendationClaim({ claim }: { claim: Claim }) {
  return (
    <li className="rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="border-l-2 border-gold pl-3.5">
        <ClaimBadge type={claim.claim_type} />
        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-midnight">{claim.text}</p>
        {claim.basis ? <p className="mt-1 text-[12px] text-muted">{claim.basis}</p> : null}
        {claim.evidence.length ? (
          <div className="mt-2">
            <EvidenceList evidence={claim.evidence} label="Based on" />
          </div>
        ) : null}
        {claim.action && "type" in claim.action ? (
          <div className="mt-3">
            <ActionControl action={claim.action} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
