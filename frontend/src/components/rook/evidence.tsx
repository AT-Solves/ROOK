import Link from "next/link";
import type { ReactNode } from "react";

import { RookIcon, type IconName } from "./icons";

/* ---------------------------------------------------------------- source icons */

export type SourceLike = { kind: string; channel: string };

/** Evidence-type glyphs: generic shapes, no third-party logos, one colour (Midnight) on a neutral tile. */
const SOURCE_TYPES: { test: (e: SourceLike) => boolean; icon: IconName; label: string }[] = [
  { test: (e) => /teams/i.test(e.channel) && e.kind === "meeting_transcript", icon: "video", label: "Meeting" },
  { test: (e) => /teams/i.test(e.channel), icon: "teams", label: "Teams" },
  { test: (e) => e.kind === "meeting_transcript", icon: "video", label: "Meeting" },
  { test: (e) => e.kind === "email", icon: "email", label: "Email" },
  { test: (e) => e.kind === "message", icon: "chat", label: "Chat" },
  { test: (e) => e.kind === "document", icon: "document", label: "Document" },
  { test: (e) => e.kind === "task_update", icon: "status", label: "Work item" },
];

export function sourceType(e: SourceLike): { icon: IconName; label: string } {
  return SOURCE_TYPES.find((s) => s.test(e)) ?? { icon: "globe", label: "External" };
}

export function RookSourceIcon({ e, icon, size = 28, tone = "light" }: { e?: SourceLike; icon?: IconName; size?: number; tone?: "light" | "dark" }) {
  const name = icon ?? (e ? sourceType(e).icon : "globe");
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
        tone === "dark" ? "border border-gold/40 bg-white/[0.04] text-gold" : "border border-line bg-surface text-midnight"
      }`}
      style={{ width: size, height: size }}
    >
      <RookIcon name={name} size={Math.round(size * 0.56)} />
    </span>
  );
}

/* ---------------------------------------------------------------- evidence disclosure */

/**
 * Evidence comes second (UX §17): a one-line disclosure ("Evidence · 3 sources") that opens onto a quiet,
 * level-3 list of cited sources. `summary` must stay plain text so it is announced as one phrase.
 */
export function RookEvidence({ summary, open = false, children }: { summary: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="group text-sm" open={open}>
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-[var(--radius-xs)] text-[12px] font-semibold text-ink-soft hover:text-midnight">
        <RookIcon name="chevronRight" size={13} strokeWidth={2.2} className="rook-disclosure text-gold-deep" />
        <RookIcon name="attachment" size={14} className="text-chess" />
        <span>{summary}</span>
      </summary>
      <ul className="mt-2.5 space-y-3 rounded-[var(--radius-sm)] bg-sunken px-3.5 py-3">{children}</ul>
    </details>
  );
}

export function RookSourceLine({
  e,
  href,
  title,
  meta,
  quote,
}: {
  e: SourceLike;
  href: string;
  title: string;
  meta: string;
  quote?: string;
}) {
  return (
    <li className="flex gap-3 text-sm">
      <RookSourceIcon e={e} size={28} />
      <div className="min-w-0">
        <Link href={href} className="font-semibold text-midnight underline-offset-2 hover:underline">
          {title}
        </Link>
        <p className="text-[12px] text-muted">{meta}</p>
        {quote ? (
          <blockquote className="mt-1.5 border-l-2 border-gold pl-2.5 font-[family-name:var(--font-quote)] text-[16px] italic leading-snug text-ink-soft">
            “{quote}”
          </blockquote>
        ) : null}
      </div>
    </li>
  );
}
