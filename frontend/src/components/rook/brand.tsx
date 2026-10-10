import { useId } from "react";

import type { RookTone } from "./tokens";

/**
 * The ROOK mark: a geometric rook built from separated horizontal bands (crown, chamfer, tower with an arrow
 * slit, collar, plinth). Vector only — never a Unicode chess glyph — and always full strength: gold on
 * Midnight, Midnight on light surfaces.
 */
function RookShapes() {
  return (
    <>
      {/* crown: three merlons on a band */}
      <path d="M16 8h8v6h4V8h8v6h4V8h8v13H16z" />
      {/* chamfer */}
      <path d="M18 22.5h28l-3.5 4h-21z" />
      {/* tower with arrow slit */}
      <path fillRule="evenodd" d="M22 28h20l2.2 16.5H19.8zM30.8 31.5v7h2.4v-7z" />
      {/* collar */}
      <path d="M17.5 46h29v4h-29z" />
      {/* plinth */}
      <path d="M14 51.5h36a2 2 0 0 1 2 2V57H12v-3.5a2 2 0 0 1 2-2z" />
    </>
  );
}

export function RookMark({
  tone = "gold",
  size = 24,
  title,
  className = "",
}: {
  tone?: "gold" | "midnight" | "board";
  size?: number;
  title?: string;
  className?: string;
}) {
  const gid = `rook-gold-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`; // React ids contain characters invalid in url(#…)
  const fill = tone === "gold" ? `url(#${gid})` : tone === "midnight" ? "var(--rook-midnight)" : "var(--rook-board-light)";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {tone === "gold" ? (
        <defs>
          <linearGradient id={gid} x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#ecd6ad" />
            <stop offset="0.5" stopColor="#d4af7c" />
            <stop offset="1" stopColor="#b48c55" />
          </linearGradient>
        </defs>
      ) : null}
      <g fill={fill}>
        <RookShapes />
      </g>
    </svg>
  );
}

const LOGO_SIZE = {
  sm: { mark: 26, word: "text-[1.35rem]", sub: "text-[12px]" },
  md: { mark: 34, word: "text-[1.75rem]", sub: "text-[13px]" },
  lg: { mark: 56, word: "text-[2.75rem]", sub: "text-base" },
  xl: { mark: 96, word: "text-[4rem]", sub: "text-xl" },
} as const;

/**
 * Primary logo. On dark: gold rook + Board Light wordmark. On light: Midnight rook + Midnight wordmark.
 * `stacked` places the mark above the wordmark (login, splash).
 */
export function RookLogo({
  tone = "dark",
  size = "md",
  subtitle = false,
  tagline = false,
  stacked = false,
}: {
  tone?: RookTone;
  size?: keyof typeof LOGO_SIZE;
  subtitle?: boolean;
  tagline?: boolean;
  stacked?: boolean;
}) {
  const s = LOGO_SIZE[size];
  const dark = tone === "dark";
  return (
    <span className={`inline-flex flex-col ${stacked ? "items-center text-center" : ""}`}>
      <span className={`inline-flex ${stacked ? "flex-col items-center gap-5" : "items-center gap-3"}`}>
        <RookMark tone={dark ? "gold" : "midnight"} size={s.mark} />
        <span className={`rook-wordmark ${s.word} ${dark ? "text-on-dark" : "text-midnight"}`}>ROOK</span>
      </span>
      {subtitle ? (
        <span className={`mt-2 font-[family-name:var(--font-display)] font-medium tracking-[0.01em] ${s.sub} ${dark ? "text-on-dark-soft" : "text-chess"}`}>
          Your AI Chief of Staff
        </span>
      ) : null}
      {tagline ? <RookTagline tone={tone} center={stacked} /> : null}
    </span>
  );
}

export function RookTagline({ tone = "dark", center = false }: { tone?: RookTone; center?: boolean }) {
  return (
    <span className={`mt-5 inline-flex flex-col gap-3 ${center ? "items-center" : ""}`}>
      <span aria-hidden className="h-px w-14 bg-gold" />
      <span className={`rook-caps ${tone === "dark" ? "text-gold" : "text-gold-deep"}`}>Context for higher judgment</span>
    </span>
  );
}

/**
 * Hero rook — a large sculpted rook for brand moments (login). Same silhouette as RookMark, rendered with a
 * horizontal light-to-shade gradient so it reads as a turned, three-dimensional gold piece, with a rim highlight
 * and a soft contact shadow. Vector only; decorative.
 */
export function RookHeroPiece({ className = "" }: { className?: string }) {
  const id = `rook-hero-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 200 310" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5a26" />
          <stop offset="0.18" stopColor="#c9a46e" />
          <stop offset="0.38" stopColor="#f0dcb6" />
          <stop offset="0.55" stopColor="#d4af7c" />
          <stop offset="0.82" stopColor="#9c7638" />
          <stop offset="1" stopColor="#5e451c" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff4dc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="292" rx="92" ry="13" fill={`url(#${id}-shadow)`} />
      <g fill={`url(#${id}-body)`}>
        {/* crown: three merlons on a band */}
        <path d="M42 36h30v28h13V36h30v28h13V36h30v62H42z" />
        {/* chamfer */}
        <path d="M46 103h108l-13 15H59z" />
        {/* tower */}
        <path d="M61 123h78l9 104H52z" />
        {/* collar */}
        <path d="M44 232h112v15H44z" />
        {/* plinth */}
        <path d="M30 252h140a8 8 0 0 1 8 8v24H22v-24a8 8 0 0 1 8-8z" />
      </g>
      {/* arrow slit */}
      <rect x="95" y="145" width="10" height="40" rx="2" fill="#3d2c10" opacity="0.85" />
      {/* light from above on each top face */}
      <g fill={`url(#${id}-top)`}>
        <path d="M42 36h30v10H42zM85 36h30v10H85zM128 36h30v10h-30zM46 103h108l-3 4H49zM44 232h112v5H44zM30 252h140v6H30z" />
      </g>
      {/* rim highlight */}
      <g fill="none" stroke="#f6e7c8" strokeOpacity="0.5" strokeWidth="1">
        <path d="M42 36h30M85 36h30M128 36h30M44 232h112M30 252h140" />
      </g>
    </svg>
  );
}
