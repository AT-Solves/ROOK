import Link from "next/link";

import type { ActionRef, Claim, RecommendedAction } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { FollowupLauncher } from "./followup";
import { ClaimBadge } from "./trust";
import { ButtonLink } from "./ui";

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
        <ButtonLink href={`/meetings/${action.meeting_id}`} variant="secondary" icon="calendar">
          Open meeting preparation
        </ButtonLink>
      );
    case "decide":
    case "review_decision":
      return (
        <ButtonLink href={`/decisions/${action.decision_id}`} variant="secondary" icon="flag">
          Review the decision
        </ButtonLink>
      );
    case "assign_owner":
      return (
        <span className="text-xs text-muted">
          ROOK can&apos;t assign owners in your systems yet; handle this directly. <Link className="underline" href={`/evidence/${action.signal_id}`}>View source</Link>
        </span>
      );
    default:
      return null;
  }
}

export function RecommendationBlock({ rec, riskId }: { rec: RecommendedAction | null; riskId?: number }) {
  if (!rec) return null;
  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[#ecdcbf] border-l-[3px] border-l-gold bg-[var(--rec-bg)] p-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2.5">
        <ClaimBadge type="RECOMMENDATION" className="self-start bg-white" />
        <p className="text-sm text-ink">{rec.text}</p>
      </div>
      <div className="mt-2">
        <ActionControl action={rec.action} riskId={riskId} />
      </div>
    </div>
  );
}

export function RecommendationClaim({ claim }: { claim: Claim }) {
  return (
    <li className="rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-gold bg-surface p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2.5">
        <ClaimBadge type={claim.claim_type} className="self-start" />
        <p className="text-sm text-ink">{claim.text}</p>
      </div>
      {claim.basis ? <p className="mt-1 text-xs text-muted">{claim.basis}</p> : null}
      {claim.evidence.length ? (
        <div className="mt-1">
          <EvidenceList evidence={claim.evidence} label="Based on" />
        </div>
      ) : null}
      <div className="mt-2">
        <ActionControl action={claim.action} />
      </div>
    </li>
  );
}
