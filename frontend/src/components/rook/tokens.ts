/**
 * ROOK design tokens for TypeScript consumers. CSS custom properties in `app/globals.css` are the source of
 * truth; these mirror them so components reference tokens by name instead of hard-coding values.
 */
export const ROOK_COLORS = {
  midnight: "#0B1220",
  gold: "#D4AF7C",
  boardLight: "#F8F7F4",
  chessGray: "#475569",
  slate: "#1E293B",
  success: "#16A34A",
  warning: "#F59E0B",
  risk: "#DC2626",
  /* derived */
  goldDeep: "#8A6420",
  surface: "#FFFEFB",
} as const;

export const ROOK_ICON_SIZE = { xs: 14, sm: 16, md: 18, lg: 22 } as const;

export const ROOK_LAYOUT = {
  sidebarWidth: "var(--sidebar-width)",
  contentWidth: "var(--content-width)",
} as const;

/** Shared class fragments: one place for card levels, so every screen uses the same three surfaces. */
export const ROOK_SURFACE = {
  /** Level 1 — executive insight: the thing to read first. */
  insight: "rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-insight)]",
  /** Level 2 — supporting card / list container. */
  card: "rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]",
  /** Level 3 — metadata and evidence: quiet, sunken, no shadow. */
  meta: "rounded-[var(--radius-sm)] bg-sunken",
  /** Dark shell surface (headers, login panels). */
  dark: "rook-dark bg-midnight text-on-dark",
} as const;

export type RookTone = "light" | "dark";
