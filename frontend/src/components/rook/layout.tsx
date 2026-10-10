import Link from "next/link";
import type { ReactNode } from "react";

import { RookMark } from "./brand";
import { RookIcon, type IconName } from "./icons";
import { RookChessPattern } from "./pattern";
import { ROOK_SURFACE } from "./tokens";

/* ---------------------------------------------------------------- page header (dark strategic band) */

/**
 * Page header: a Midnight panel with the chessboard texture — the dark shell reaching into the workspace.
 * Eyebrow "ROOK / SECTION", editorial serif title, one-line tagline, optional meta row and actions.
 */
export function RookPageHeader({
  eyebrow,
  title,
  tagline,
  meta,
  actions,
  size = "page",
}: {
  eyebrow: string;
  title: ReactNode;
  tagline?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  size?: "hero" | "page" | "detail";
}) {
  const titleSize = size === "hero" ? "text-[2.5rem] md:text-[3.25rem]" : size === "page" ? "text-[2.25rem] md:text-[2.75rem]" : "text-[1.75rem] md:text-[2.125rem]";
  const pad = size === "hero" ? "px-6 py-8 md:px-10 md:py-10" : "px-6 py-7 md:px-9 md:py-8";
  return (
    <header className={`${ROOK_SURFACE.dark} relative mb-8 overflow-hidden rounded-[var(--radius-lg)] ${pad}`}>
      <RookChessPattern variant="dark" fade="right" opacity={0.8} />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-gold/70 via-gold/20 to-transparent" />
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          <p className="rook-caps flex items-center gap-2 text-gold">
            <RookMark tone="gold" size={14} />
            <span>
              ROOK <span aria-hidden className="mx-1 text-on-dark-muted">/</span> {eyebrow}
            </span>
          </p>
          <h1 className={`rook-display mt-3 text-on-dark ${titleSize}`}>{title}</h1>
          {tagline ? <p className="mt-2 text-[15px] leading-relaxed text-on-dark-soft">{tagline}</p> : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-on-dark-soft">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- sections */

export function RookSectionHeader({
  id,
  title,
  count,
  icon,
  more,
}: {
  id: string;
  title: string;
  count?: number;
  icon?: IconName;
  more?: { href: string; label: string };
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3 border-b border-line pb-2.5">
      <h2 id={id} className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[var(--tracking-caps)] text-ink-soft">
        {icon ? <RookIcon name={icon} size={16} className="text-midnight" /> : <span aria-hidden className="h-2 w-2 bg-gold" />}
        <span>
          {title}
          {count !== undefined ? <span className="ml-2 font-medium normal-case tracking-normal text-muted">· {count}</span> : null}
        </span>
      </h2>
      {more ? (
        <Link href={more.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft underline-offset-4 hover:text-midnight hover:underline">
          {more.label}
          <RookIcon name="chevronRight" size={14} />
        </Link>
      ) : null}
    </div>
  );
}

export function RookSection({
  title,
  count,
  id,
  children,
  more,
  icon,
  className = "",
}: {
  title: string;
  count?: number;
  id: string;
  children: ReactNode;
  more?: { href: string; label: string };
  icon?: IconName;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`mb-10 ${className}`}>
      <RookSectionHeader id={id} title={title} count={count} icon={icon} more={more} />
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- cards */

const LEVEL = { 1: ROOK_SURFACE.insight, 2: ROOK_SURFACE.card, 3: ROOK_SURFACE.meta } as const;
const PAD = { 1: "p-5 md:p-6", 2: "p-4", 3: "p-3" } as const;

/** Three card levels: 1 executive insight · 2 supporting · 3 metadata/evidence. */
export function RookCard({
  children,
  level = 2,
  as: As = "div",
  className = "",
  interactive = false,
  flush = false,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  as?: "div" | "li" | "article" | "section" | "dl";
  className?: string;
  interactive?: boolean;
  /** No inner padding: for divided lists that run edge to edge. */
  flush?: boolean;
}) {
  return <As className={`${LEVEL[level]} ${flush ? "overflow-hidden" : PAD[level]} ${interactive ? "rook-interactive" : ""} ${className}`}>{children}</As>;
}

/** Labelled field in a detail record (rendered inside a <dl>). */
export function RookField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-line py-3 last:border-b-0 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-6">
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14px] leading-relaxed text-ink-soft sm:mt-0">{children}</dd>
    </div>
  );
}

/** Small metadata item: icon + text, used in card meta rows. */
export function RookMeta({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RookIcon name={icon} size={14} className="text-chess" />
      {children}
    </span>
  );
}
