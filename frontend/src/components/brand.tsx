import { useId } from "react";

/**
 * ROOK logo system (design reference: "Logo variations"). The geometric rook is the primary brand symbol.
 * Vector only — never a Unicode chess glyph. Crisp from 16px (favicon) to hero sizes.
 */

const ROOK_PATHS = (
  <>
    {/* crenellated crown */}
    <path d="M17 9h7v5.5h5V9h6v5.5h5V9h7v14H17z" />
    {/* collar */}
    <path d="M19 24.5h26v3.5H19z" />
    {/* tapered body */}
    <path d="M23 29.5h18l1.6 15h-21.2z" />
    {/* base ring and plinth */}
    <path d="M19.5 46h25v3.5h-25z" />
    <path d="M15.5 51h33a2 2 0 0 1 2 2v4h-37v-4a2 2 0 0 1 2-2z" />
  </>
);

export function RookMark({ tone = "gold", size = 24, title, className = "" }: { tone?: "gold" | "midnight" | "white" | "outline"; size?: number; title?: string; className?: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, ""); // React ids contain characters invalid in url(#…)
  const fill = tone === "gold" ? `url(#rook-gold-${gid})` : tone === "midnight" ? "var(--rook-midnight)" : "#ffffff";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {tone === "gold" ? (
        <defs>
          <linearGradient id={`rook-gold-${gid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#ecd3a6" />
            <stop offset="0.55" stopColor="#d4af7c" />
            <stop offset="1" stopColor="#a9834c" />
          </linearGradient>
        </defs>
      ) : null}
      {tone === "outline" ? (
        // Watermark variant: hairline gold outline keeps the brand colour at low visual weight on midnight.
        <g fill="none" stroke="var(--rook-gold)" strokeWidth="0.6" strokeLinejoin="round">{ROOK_PATHS}</g>
      ) : (
        <g fill={fill}>{ROOK_PATHS}</g>
      )}
    </svg>
  );
}

/** Primary logo: rook + ROOK wordmark (+ optional "Your AI Chief of Staff" and tagline). */
export function Logo({
  surface = "dark",
  size = "md",
  subtitle = false,
  tagline = false,
}: {
  surface?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl";
  subtitle?: boolean;
  tagline?: boolean;
}) {
  const dims = { sm: [22, "text-lg"], md: [30, "text-2xl"], lg: [52, "text-4xl"], xl: [88, "text-6xl"] } as const;
  const [mark, word] = dims[size];
  const onDark = surface === "dark";
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2.5">
        <RookMark tone={onDark ? "gold" : "midnight"} size={mark} />
        <span
          className={`font-[family-name:var(--font-wordmark)] font-semibold leading-none tracking-[0.08em] ${word} ${onDark ? "text-gold" : "text-midnight"}`}
        >
          ROOK
        </span>
      </span>
      {subtitle ? (
        <span className={`mt-2 font-[family-name:var(--font-display)] ${size === "xl" ? "text-3xl" : "text-lg"} ${onDark ? "text-white" : "text-midnight"}`}>
          Your AI Chief of Staff
        </span>
      ) : null}
      {tagline ? <Tagline surface={surface} /> : null}
    </span>
  );
}

export function Tagline({ surface = "dark" }: { surface?: "dark" | "light" }) {
  return (
    <span className="mt-3 inline-flex flex-col gap-2">
      <span aria-hidden className="h-px w-16 bg-gold" />
      <span className={`text-[11px] font-medium uppercase tracking-[0.32em] ${surface === "dark" ? "text-slate-200" : "text-chess"}`}>
        Context for higher judgment
      </span>
    </span>
  );
}

/** App icon (dark or light) — rounded tile with the rook. */
export function AppIcon({ surface = "dark", size = 40 }: { surface?: "dark" | "light"; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-[22%] ${surface === "dark" ? "bg-midnight" : "border border-line bg-white"}`}
      style={{ width: size, height: size }}
    >
      <RookMark tone={surface === "dark" ? "gold" : "midnight"} size={Math.round(size * 0.7)} />
    </span>
  );
}

/** Compact monogram — gold R on midnight. */
export function Monogram({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-[22%] bg-midnight font-[family-name:var(--font-wordmark)] font-bold text-gold"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      R
    </span>
  );
}
