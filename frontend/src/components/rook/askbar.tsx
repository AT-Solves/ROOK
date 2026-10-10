import type { ReactNode } from "react";

import { RookMark } from "./brand";
import { ROOK_BUTTON } from "./button";

export const ASK_PLACEHOLDER = "What changed, what matters, and what should I do?";

/**
 * Ask ROOK — the signature input. Midnight rook tile, quiet editorial field, Midnight submit with the gold rook;
 * gold border and soft glow on focus. Presentational: the caller owns state and submission.
 */
export function RookAskBar({
  inputId,
  value,
  onChange,
  onSubmit,
  busy = false,
  size = "standard",
  footer,
  placeholder = ASK_PLACEHOLDER,
}: {
  inputId: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  size?: "standard" | "hero";
  footer?: ReactNode;
  placeholder?: string;
}) {
  const hero = size === "hero";
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={`rook-askbar flex flex-col gap-2 rounded-[var(--radius-lg)] border border-line-strong bg-surface p-2 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] sm:flex-row sm:items-center`}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask ROOK a question
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-midnight ${hero ? "h-11 w-11" : "h-10 w-10"}`}>
            <RookMark tone="gold" size={hero ? 26 : 22} />
          </span>
          <input
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={1000}
            autoComplete="off"
            className={`min-w-0 flex-1 bg-transparent py-2 text-midnight placeholder:text-chess focus:outline-none focus-visible:outline-none ${hero ? "text-[17px]" : "text-[15px]"}`}
          />
        </div>
        <button type="submit" disabled={busy || !value.trim()} className={`${ROOK_BUTTON.primary} disabled:opacity-100 ${hero ? "px-5 py-2.5" : ""}`}>
          <RookMark tone="gold" size={16} />
          <span>{busy ? "Analyzing…" : "Ask ROOK"}</span>
        </button>
      </form>
      {footer}
    </div>
  );
}
