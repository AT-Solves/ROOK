import type { CSSProperties } from "react";

const FADE = {
  right: "rook-fade-right",
  left: "rook-fade-left",
  down: "rook-fade-down",
  radial: "rook-fade-radial",
  none: "",
} as const;

/**
 * Chessboard — the brand's signature surface, drawn in CSS (no image dependency).
 *  • dark  — Midnight #0B1220 / Slate #1E293B, texture scale (sidebar, page headers).
 *  • light — Board Light #F8F7F4 / #E7E2D8, texture scale (empty and loading states).
 *  • hero  — Midnight / Slate at hero scale (64px squares; 40px on small screens): unmistakably a board.
 * `opacity` controls how strongly the board reads over its surface; `fade` masks it toward one side.
 * Decorative only; place inside a `relative` parent.
 */
export function RookChessPattern({
  variant = "light",
  fade = "none",
  opacity = 1,
  square,
  className = "",
}: {
  variant?: "dark" | "light" | "hero";
  fade?: keyof typeof FADE;
  opacity?: number;
  /** Square size in px; defaults to the token for the variant. */
  square?: number;
  className?: string;
}) {
  const light = variant === "light";
  const size = square ? `${square}px` : variant === "hero" ? "var(--chess-hero-size)" : "var(--chess-size)";
  const style = {
    "--chess-a": light ? "var(--chess-light-a)" : "var(--chess-dark-a)",
    "--chess-b": light ? "var(--chess-light-b)" : "var(--chess-dark-b)",
    "--chess-square2": `calc(${size} * 2)`,
    opacity,
  } as CSSProperties;
  return <span aria-hidden style={style} className={`rook-chess pointer-events-none absolute inset-0 ${FADE[fade]} ${className}`} />;
}
