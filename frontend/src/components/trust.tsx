import type { ClaimType, Confidence, Level } from "@/lib/types";

/**
 * Epistemic labels (PRD §7). Always rendered as text — never colour alone — so an inference can never be
 * mistaken for a fact, including by screen-reader users.
 */
export const CLAIM_COPY: Record<ClaimType, { label: string; description: string; className: string }> = {
  FACT: {
    label: "Fact",
    description: "Stated explicitly in a source you can open.",
    className: "bg-[var(--fact-bg)] text-[var(--fact-ink)] border-transparent",
  },
  INFERENCE: {
    label: "Inference",
    description: "Derived by ROOK from the cited sources; not stated by anyone.",
    className: "bg-[var(--inf-bg)] text-[var(--inf-ink)] border-transparent",
  },
  RECOMMENDATION: {
    label: "Recommendation",
    description: "A suggested next step. ROOK never acts on it without your approval.",
    className: "bg-[var(--rec-bg)] text-[var(--rec-ink)] border-transparent",
  },
  UNKNOWN: {
    label: "Unknown",
    description: "ROOK lacks the evidence to say.",
    className: "bg-[var(--unk-bg)] text-[var(--unk-ink)] border-dashed border-[var(--unk-ink)]",
  },
};

export function ClaimBadge({ type, className = "" }: { type: ClaimType; className?: string }) {
  const c = CLAIM_COPY[type] ?? CLAIM_COPY.UNKNOWN;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${c.className} ${className}`}
      title={c.description}
      data-claim-type={type}
    >
      {c.label}
      <span className="sr-only">: {c.description}</span>
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: Confidence }) {
  return <span className="text-xs text-muted">{value} confidence</span>;
}

const LEVEL_CLASS: Record<Level, string> = {
  high: "bg-[var(--high-bg)] text-[var(--high-ink)]",
  medium: "bg-[var(--med-bg)] text-[var(--med-ink)]",
  low: "bg-[var(--low-bg)] text-[var(--low-ink)]",
};

/** Severity is a word, not a score (UX §9: no unexplained AI scores). */
export function LevelPill({ level, noun = "risk" }: { level: Level; noun?: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_CLASS[level]}`}>
      {level} {noun}
    </span>
  );
}

export function StatusText({ status }: { status: string }) {
  const map: Record<string, string> = {
    overdue: "Overdue",
    open: "Open",
    done: "Done",
    proposed: "Suggested — needs an owner",
    dropped: "Dismissed",
    pending: "Pending",
    made: "Decided",
    acknowledged: "Acknowledged",
    resolved: "Resolved",
  };
  return <span className="text-xs font-medium text-muted">{map[status] ?? status}</span>;
}
