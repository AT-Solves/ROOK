import type { ReactNode } from "react";

/**
 * ROOK icon family (design reference: "Feature icons", "App icons", "Evidence type icons").
 * One geometry: 24px grid, 1.75 stroke, round joins. `accent` renders the highlight parts in Rook Gold
 * (feature-icon style); without it the icon is monochrome (navigation style). Icons are decorative unless
 * given a `label`, in which case they are announced to assistive technology.
 */

type Parts = { base: ReactNode; accent?: ReactNode };

const ICONS = {
  home: { base: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9v11.5h13V9" /></>, accent: <path d="M10 20.5V15h4v5.5" /> },
  ask: { base: <path d="M4 5h16v11H9.5L5 19.5V16H4z" />, accent: <><circle cx="9" cy="10.5" r=".9" fill="currentColor" /><circle cx="12" cy="10.5" r=".9" fill="currentColor" /><circle cx="15" cy="10.5" r=".9" fill="currentColor" /></> },
  calendar: { base: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>, accent: <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" strokeWidth="2.4" /> },
  document: { base: <><path d="M6 3h8.5L18 6.5V21H6z" /><path d="M14.5 3v3.5H18" /></>, accent: <path d="M9 11.5h6M9 15h6M9 18h3.5" /> },
  checkSquare: { base: <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />, accent: <path d="m8 12.2 2.8 2.8L16 9.5" /> },
  risk: { base: <path d="M12 3.5 21.5 20h-19z" />, accent: <><path d="M12 9.5v5" /><path d="M12 17.4h.01" strokeWidth="2.4" /></> },
  database: { base: <><ellipse cx="12" cy="6" rx="7.5" ry="2.6" /><path d="M4.5 6v12c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6V6" /></>, accent: <path d="M4.5 12c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6" /> },
  email: { base: <rect x="3" y="5.5" width="18" height="13" rx="2" />, accent: <path d="m3.8 6.8 8.2 6.2 8.2-6.2" /> },
  teams: { base: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /></>, accent: <><circle cx="16.5" cy="9" r="2.4" /><path d="M16.3 14c2.3.1 3.9 1.6 4.3 4.6" /></> },
  person: { base: <path d="M5 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />, accent: <circle cx="12" cy="8" r="3.6" /> },
  attachment: { base: <path d="M15.5 7.5 8.6 14.4a2.2 2.2 0 0 0 3.1 3.1l7-7a4 4 0 0 0-5.7-5.7l-7 7a5.8 5.8 0 0 0 8.2 8.2l5.3-5.3" /> },
  related: { base: <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1" />, accent: <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /> },
  insight: { base: <><path d="M9.5 18h5M10.5 21h3" /><path d="M12 5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6V16h5v-.5c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 5z" /></>, accent: <path d="M12 2v1M4.2 5.2l.8.8M19.8 5.2l-.8.8M2.5 12h1M20.5 12h1" /> },
  target: { base: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /></>, accent: <><circle cx="12" cy="12" r="1.3" fill="currentColor" /><path d="m12 12 7-7M16.5 4.5H19.5v3" /></> },
  checkCircle: { base: <circle cx="12" cy="12" r="8.5" />, accent: <path d="m8.3 12.2 2.6 2.6 4.9-5.3" /> },
  flag: { base: <path d="M5.5 21V3.5" />, accent: <path d="M5.5 4h12l-2.5 4 2.5 4h-12" /> },
  status: { base: <path d="M3.5 20.5h17M7 17v-3.5M11 17V9.5M15 17v-5" />, accent: <path d="M19 17V6" /> },
  clock: { base: <circle cx="12" cy="12" r="8.5" />, accent: <path d="M12 7.5V12l3 2" /> },
  tag: { base: <path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z" />, accent: <circle cx="8" cy="8.3" r="1.3" /> },
  filter: { base: <path d="M4 5h16l-6 7.5V19l-4 2v-8.5z" /> },
  search: { base: <circle cx="10.5" cy="10.5" r="6.5" />, accent: <path d="m15.5 15.5 5 5" /> },
  sliders: { base: <path d="M4 7h9M19 7h1M4 17h3.5M12.5 17H20" />, accent: <><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></> },
  more: { base: <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></> },
  send: { base: <path d="M20.5 3.5 3.5 10.6l6.8 2.6 2.6 6.8z" />, accent: <path d="m20.5 3.5-10.2 9.7" /> },
  chevronRight: { base: <path d="m9.5 6 6 6-6 6" /> },
  arrowRight: { base: <path d="M4.5 12h15M13.5 6l6 6-6 6" /> },
  refresh: { base: <><path d="M20 11.5A8 8 0 1 0 17.7 17" /><path d="M20.5 4.5v7h-7" /></> },
  video: { base: <rect x="3" y="6.5" width="12.5" height="11" rx="2" />, accent: <path d="m15.5 10.5 5-3v9l-5-3z" /> },
  chat: { base: <path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L4.5 19.5l1.2-3.6C4.3 14.6 3.5 12.9 3.5 11c0-3.9 3.8-7 8.5-7z" /> },
  globe: { base: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /></>, accent: <path d="M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5z" /> },
  lock: { base: <rect x="5" y="10.5" width="14" height="10" rx="2" />, accent: <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /> },
  external: { base: <path d="M18 14v6H4V6h6" />, accent: <path d="M14 4h6v6M20 4l-9 9" /> },
  briefcase: { base: <><rect x="3.5" y="7.5" width="17" height="12.5" rx="2" /><path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>, accent: <path d="M3.5 12.5h17" /> },
} satisfies Record<string, Parts>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  accent = false,
  label,
  className = "",
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  accent?: boolean;
  label?: string;
  className?: string;
  strokeWidth?: number;
}) {
  const parts: Parts = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {parts.base}
      {parts.accent ? <g className={accent ? "text-gold" : undefined}>{parts.accent}</g> : null}
    </svg>
  );
}

/** Navigation modules → icon + coloured app-icon tile (design reference "App icons (coloured)"). */
export const MODULES = {
  home: { icon: "home", tile: "bg-midnight text-gold" },
  ask: { icon: "ask", tile: "bg-chess text-white" },
  meetings: { icon: "calendar", tile: "bg-[#24426b] text-white" },
  decisions: { icon: "document", tile: "bg-gold text-midnight" },
  commitments: { icon: "checkSquare", tile: "bg-[#15803d] text-white" },
  risks: { icon: "risk", tile: "bg-[#b91c1c] text-white" },
  sources: { icon: "database", tile: "bg-slate text-white" },
} as const satisfies Record<string, { icon: IconName; tile: string }>;

export type ModuleName = keyof typeof MODULES;

export function ModuleTile({ module, size = 40 }: { module: ModuleName; size?: number }) {
  const m = MODULES[module];
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-[10px] ${m.tile}`} style={{ width: size, height: size }}>
      <Icon name={m.icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Feature icon tile: white square, dark glyph with gold accents. */
export function FeatureTile({ name, size = 36, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[9px] border border-line bg-white text-midnight shadow-[var(--shadow-card)]"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon name={name} size={Math.round(size * 0.56)} accent />
    </span>
  );
}
