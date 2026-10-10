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
