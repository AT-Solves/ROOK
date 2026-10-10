import type { ReactNode } from "react";

/**
 * Status badges. Two shapes, both compact and text-first (colour never carries meaning alone):
 *  • trust   — the epistemic label (FACT / INFERENCE / RECOMMENDATION / UNKNOWN): a small tinted tag in caps
 *              with a chess-square marker.
 *  • status  — severity and lifecycle (High risk, Overdue, Decided…): plain text with a square marker; no pill.
 */
export type RookTrustTone = "fact" | "inference" | "recommendation" | "unknown";
export type RookStatusTone = "risk" | "warn" | "ok" | "neutral" | "info";

const TRUST: Record<RookTrustTone, { tag: string; mark: string }> = {
  fact: { tag: "bg-[var(--fact-bg)] text-[var(--fact-ink)]", mark: "bg-[var(--fact-mark)]" },
  inference: { tag: "bg-[var(--inf-bg)] text-[var(--inf-ink)]", mark: "bg-[var(--inf-mark)]" },
  recommendation: { tag: "bg-[var(--rec-bg)] text-[var(--rec-ink)]", mark: "bg-[var(--rec-mark)]" },
  unknown: {
    tag: "bg-[var(--unk-bg)] text-[var(--unk-ink)] outline outline-1 -outline-offset-1 outline-dashed outline-[var(--unk-mark)]",
    mark: "border border-[var(--unk-mark)] bg-transparent",
  },
};

const STATUS: Record<RookStatusTone, { text: string; mark: string }> = {
  risk: { text: "text-[var(--risk-ink)]", mark: "bg-[var(--risk-mark)]" },
  warn: { text: "text-[var(--warn-ink)]", mark: "bg-[var(--warn-mark)]" },
  ok: { text: "text-[var(--ok-ink)]", mark: "bg-[var(--ok-mark)]" },
  neutral: { text: "text-[var(--neutral-ink)]", mark: "bg-[var(--neutral-mark)]" },
  info: { text: "text-[var(--info-ink)]", mark: "bg-[var(--info-mark)]" },
};

export function RookStatusBadge(
  props:
    | { variant: "trust"; tone: RookTrustTone; children: ReactNode; description?: string; className?: string; dataClaimType?: string }
    | { variant?: "status"; tone: RookStatusTone; children: ReactNode; className?: string; onDark?: boolean },
) {
  if (props.variant === "trust") {
    const t = TRUST[props.tone];
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-[3px] text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] ${t.tag} ${props.className ?? ""}`}
        title={props.description}
        data-claim-type={props.dataClaimType}
      >
        <span aria-hidden className={`h-[6px] w-[6px] ${t.mark}`} />
        {props.children}
        {props.description ? <span className="sr-only">: {props.description}</span> : null}
      </span>
    );
  }
  const s = STATUS[props.tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold leading-5 ${props.onDark ? "text-on-dark" : s.text} ${props.className ?? ""}`}>
      <span aria-hidden className={`h-[7px] w-[7px] ${s.mark}`} />
      {props.children}
    </span>
  );
}
