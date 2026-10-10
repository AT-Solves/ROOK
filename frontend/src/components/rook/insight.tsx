import Link from "next/link";
import type { ReactNode } from "react";

import { RookIcon } from "./icons";

const ACCENT = {
  risk: "before:bg-risk",
  warn: "before:bg-warning",
  gold: "before:bg-gold",
  none: "before:hidden",
} as const;

const EMPHASIS = {
  featured: { box: "rounded-[var(--radius-lg)] p-5 md:p-6 shadow-[var(--shadow-insight)]", title: "rook-display text-[1.5rem] md:text-[1.7rem] text-midnight" },
  standard: { box: "rounded-[var(--radius-md)] p-4 md:p-5 shadow-[var(--shadow-card)]", title: "text-[15.5px] font-semibold leading-snug text-midnight" },
} as const;

/**
 * Insight card — progressive disclosure, readable in three seconds:
 *   claim label → title → signals (severity · confidence) → one-line explanation
 *   → "Why ROOK believes this" (expand) → evidence (expand) → recommendation / action.
 * Risk is restrained: a thin coloured edge, never a coloured background.
 */
export function RookInsightCard({
  label,
  eyebrow,
  title,
  href,
  signals,
  summary,
  why,
  evidence,
  action,
  accent = "none",
  emphasis = "standard",
  clampSummary = false,
  as: As = "li",
}: {
  label: ReactNode;
  eyebrow?: string;
  title: string;
  href?: string;
  signals?: ReactNode;
  summary?: ReactNode;
  why?: ReactNode;
  evidence?: ReactNode;
  action?: ReactNode;
  accent?: keyof typeof ACCENT;
  emphasis?: keyof typeof EMPHASIS;
  /** Keep the explanation to two lines (the full text belongs in `why`). */
  clampSummary?: boolean;
  as?: "li" | "article" | "div";
}) {
  const e = EMPHASIS[emphasis];
  return (
    <As
      className={`rook-interactive relative overflow-hidden border border-line bg-surface ${e.box} before:absolute before:inset-y-0 before:left-0 before:w-[2px] ${ACCENT[accent]}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {label}
        {eyebrow ? <span className="text-[12px] font-semibold text-muted">{eyebrow}</span> : null}
      </div>
      <p className={`mt-2.5 ${e.title}`}>
        {href ? (
          <Link href={href} className="underline-offset-4 decoration-gold decoration-[1.5px] hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </p>
      {signals ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">{signals}</div> : null}
      {summary ? <p className={`mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-soft ${clampSummary ? "line-clamp-2" : ""}`}>{summary}</p> : null}
      {why || evidence ? (
        <div className="mt-3 flex flex-col items-start gap-2">
          {why ? (
            <details className="group w-full text-sm">
              <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-[var(--radius-xs)] text-[12px] font-semibold text-ink-soft hover:text-midnight">
                <RookIcon name="chevronRight" size={13} strokeWidth={2.2} className="rook-disclosure text-gold-deep" />
                <RookIcon name="insight" size={14} className="text-chess" />
                <span>Why ROOK believes this</span>
              </summary>
              <div className="mt-2 max-w-3xl rounded-[var(--radius-sm)] bg-sunken px-3.5 py-3 text-[14px] leading-relaxed text-ink-soft">{why}</div>
            </details>
          ) : null}
          {evidence}
        </div>
      ) : null}
      {action ? <div className="mt-4 border-t border-line pt-4">{action}</div> : null}
    </As>
  );
}
