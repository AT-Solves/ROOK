import type { ReactNode } from "react";

import type { ClaimType, Confidence, Level } from "@/lib/types";

import { RookStatusBadge, type RookStatusTone, type RookTrustTone } from "./rook";

/**
 * Trust vocabulary (PRD §7). Epistemic labels are always visible text plus a screen-reader description —
 * never colour alone — so an inference can never be mistaken for a fact.
 */
export const CLAIM_COPY: Record<ClaimType, { label: string; description: string; tone: RookTrustTone }> = {
  FACT: { label: "Fact", description: "Stated explicitly in a source you can open.", tone: "fact" },
  INFERENCE: { label: "Inference", description: "Derived by ROOK from the cited sources; not stated by anyone.", tone: "inference" },
  RECOMMENDATION: { label: "Recommendation", description: "A suggested next step. ROOK never acts on it without your approval.", tone: "recommendation" },
  UNKNOWN: { label: "Unknown", description: "ROOK lacks the evidence to say.", tone: "unknown" },
};

export function ClaimBadge({ type, className = "" }: { type: ClaimType; className?: string }) {
  const c = CLAIM_COPY[type] ?? CLAIM_COPY.UNKNOWN;
  return (
    <RookStatusBadge variant="trust" tone={c.tone} description={c.description} dataClaimType={type} className={className}>
      {c.label}
    </RookStatusBadge>
  );
}

export function ConfidenceLabel({ value, onDark = false }: { value: Confidence; onDark?: boolean }) {
  return <span className={`text-[12px] ${onDark ? "text-on-dark-soft" : "text-muted"}`}>{value[0].toUpperCase() + value.slice(1)} confidence</span>;
}

const LEVEL_TONE: Record<Level, RookStatusTone> = { high: "risk", medium: "warn", low: "neutral" };

/** Severity is a word, not a score (UX §9: no unexplained AI scores). */
export function LevelPill({ level, noun = "risk", onDark = false }: { level: Level; noun?: string; onDark?: boolean }) {
  return (
    <RookStatusBadge tone={LEVEL_TONE[level]} onDark={onDark}>
      {level[0].toUpperCase() + level.slice(1)} {noun}
    </RookStatusBadge>
  );
}

const STATUS: Record<string, { label: string; tone: RookStatusTone }> = {
  overdue: { label: "Overdue", tone: "warn" },
  open: { label: "Open", tone: "ok" },
  done: { label: "Done", tone: "neutral" },
  proposed: { label: "Suggested — needs an owner", tone: "neutral" },
  dropped: { label: "Dismissed", tone: "neutral" },
  pending: { label: "Pending", tone: "warn" },
  made: { label: "Decided", tone: "ok" },
  acknowledged: { label: "Acknowledged", tone: "neutral" },
  resolved: { label: "Resolved", tone: "neutral" },
  upcoming: { label: "Upcoming", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
};

export function StatusText({ status, onDark = false }: { status: string; onDark?: boolean }) {
  const s = STATUS[status];
  if (!s) return <span className={`text-[12px] font-medium ${onDark ? "text-on-dark-soft" : "text-muted"}`}>{status}</span>;
  return (
    <RookStatusBadge tone={s.tone} onDark={onDark}>
      {s.label}
    </RookStatusBadge>
  );
}

/** Trust row used in detail headers: label · confidence · basis. */
export function TrustRow({ type, confidence, basis, children }: { type: ClaimType; confidence?: Confidence; basis?: string; children?: ReactNode }) {
  return (
    <>
      <ClaimBadge type={type} />
      {children}
      {confidence ? <ConfidenceLabel value={confidence} onDark /> : null}
      {basis ? <span className="text-[12px] text-on-dark-muted">{basis}</span> : null}
    </>
  );
}
