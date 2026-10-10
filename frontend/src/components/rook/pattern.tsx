import type { RookTone } from "./tokens";

const FADE = {
  right: "rook-fade-right",
  left: "rook-fade-left",
  down: "rook-fade-down",
  radial: "rook-fade-radial",
  none: "",
} as const;

/**
 * Chessboard texture — the brand's signature surface. Light: Board Light with warm-gray squares. Dark: Midnight
 * with Slate squares. Always decorative and faded so text stays fully legible; place inside a `relative` parent.
 */
export function RookChessPattern({
  tone = "light",
  fade = "right",
  className = "",
}: {
  tone?: RookTone;
  fade?: keyof typeof FADE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${tone === "dark" ? "rook-chess-dark" : "rook-chess-light"} ${FADE[fade]} ${className}`}
    />
  );
}
