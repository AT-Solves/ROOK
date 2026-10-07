import type { ClaimType, Confidence, Level } from "@/lib/types";

import { Icon, type IconName } from "./icons";

/**
 * Status chips (design reference "Status chips"). Epistemic labels (PRD §7) are always visible text plus a
 * screen-reader description — never colour alone — so an inference can never be mistaken for a fact.
 */
export const CLAIM_COPY: Record<ClaimType, { label: string; description: string; chip: string; dot: string }> = {
  FACT: {
    label: "Fact",
    description: "Stated explicitly in a source you can open.",
    chip: "bg-[var(--fact-bg)] text-[var(--fact-ink)]",
    dot: "bg-[var(--fact-dot)]",
  },
  INFERENCE: {
    label: "Inference",
    description: "Derived by ROOK from the cited sources; not stated by anyone.",
    chip: "bg-[var(--inf-bg)] text-[var(--inf-ink)]",
    dot: "bg-[var(--inf-dot)]",
  },
  RECOMMENDATION: {
    label: "Recommendation",
    description: "A suggested next step. ROOK never acts on it without your approval.",
    chip: "bg-[var(--rec-bg)] text-[var(--rec-ink)]",
    dot: "bg-[var(--rec-dot)]",
  },
  UNKNOWN: {
    label: "Unknown",
    description: "ROOK lacks the evidence to say.",
    chip: "bg-[var(--unk-bg)] text-[var(--unk-ink)] outline outline-1 outline-dashed outline-[var(--unk-dot)]",
    dot: "bg-[var(--unk-dot)]",
  },
};

const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5";

export function ClaimBadge({ type, className = "" }: { type: ClaimType; className?: string }) {
  const c = CLAIM_COPY[type] ?? CLAIM_COPY.UNKNOWN;
  return (
    <span className={`${CHIP} ${c.chip} ${className}`} title={c.description} data-claim-type={type}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${c.dot}`} />
      {c.label}
      <span className="sr-only">: {c.description}</span>
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: Confidence }) {
  return <span className="text-xs text-muted">{value} confidence</span>;
}

/* Status chips with icons: severity and lifecycle. Meaning is carried by the words; icons and colour reinforce. */
type Tone = "high" | "med" | "low" | "ok" | "up" | "done";
const TONE: Record<Tone, { chip: string; icon: string }> = {
  high: { chip: "bg-[var(--high-bg)] text-[var(--high-ink)]", icon: "text-[var(--high-icon)]" },
  med: { chip: "bg-[var(--med-bg)] text-[var(--med-ink)]", icon: "text-[var(--med-icon)]" },
  low: { chip: "bg-[var(--low-bg)] text-[var(--low-ink)]", icon: "text-[var(--low-icon)]" },
  ok: { chip: "bg-[var(--ok-bg)] text-[var(--ok-ink)]", icon: "text-[var(--ok-icon)]" },
  up: { chip: "bg-[var(--up-bg)] text-[var(--up-ink)]", icon: "text-[var(--up-icon)]" },
  done: { chip: "bg-[var(--done-bg)] text-[var(--done-ink)]", icon: "text-[var(--done-icon)]" },
};

export function StatusChip({ tone, icon, children }: { tone: Tone; icon: IconName; children: React.ReactNode }) {
  return (
    <span className={`${CHIP} ${TONE[tone].chip}`}>
      <Icon name={icon} size={14} strokeWidth={2} className={TONE[tone].icon} />
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<Level, Tone> = { high: "high", medium: "med", low: "low" };

/** Severity is a word, not a score (UX §9: no unexplained AI scores). */
export function LevelPill({ level, noun = "risk" }: { level: Level; noun?: string }) {
  return (
    <StatusChip tone={LEVEL_TONE[level]} icon="risk">
      {level[0].toUpperCase() + level.slice(1)} {noun}
    </StatusChip>
  );
}

const STATUS: Record<string, { label: string; tone: Tone; icon: IconName }> = {
  overdue: { label: "Overdue", tone: "med", icon: "risk" },
  open: { label: "Open", tone: "ok", icon: "checkCircle" },
  done: { label: "Done", tone: "done", icon: "checkCircle" },
  proposed: { label: "Suggested — needs an owner", tone: "low", icon: "person" },
  dropped: { label: "Dismissed", tone: "done", icon: "more" },
  pending: { label: "Pending", tone: "med", icon: "clock" },
  made: { label: "Decided", tone: "ok", icon: "flag" },
  acknowledged: { label: "Acknowledged", tone: "done", icon: "checkCircle" },
  resolved: { label: "Resolved", tone: "done", icon: "checkCircle" },
  upcoming: { label: "Upcoming", tone: "up", icon: "calendar" },
  ended: { label: "Ended", tone: "done", icon: "checkCircle" },
};

export function StatusText({ status }: { status: string }) {
  const s = STATUS[status];
  if (!s) return <span className="text-xs font-medium text-muted">{status}</span>;
  return (
    <StatusChip tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusChip>
  );
}
