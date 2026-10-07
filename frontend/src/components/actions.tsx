import Link from "next/link";

import type { ActionRef, Claim, RecommendedAction } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { FollowupLauncher } from "./followup";
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
        <Link href={`/meetings/${action.meeting_id}`} className="text-sm font-medium text-accent hover:underline">
          Open meeting preparation →
        </Link>
      );
    case "decide":
    case "review_decision":
      return (
        <Link href={`/decisions/${action.decision_id}`} className="text-sm font-medium text-accent hover:underline">
          Review the decision →
        </Link>
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
    <div className="mt-3 rounded-md bg-[var(--rec-bg)] p-3">
      <div className="flex items-start gap-2">
        <ClaimBadge type="RECOMMENDATION" />
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
    <li className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <ClaimBadge type={claim.claim_type} />
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
