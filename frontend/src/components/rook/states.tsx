import type { ReactNode } from "react";

import { RookMark } from "./brand";
import { RookIcon, type IconName } from "./icons";
import { RookChessPattern } from "./pattern";

/** Loading: the rook steadies while ROOK names the stage it is in (UX §13). Never a blank screen. */
export function RookLoadingState({ stage, children }: { stage: string; children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="relative flex items-center gap-3.5 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface px-5 py-6 text-sm text-muted">
      <RookChessPattern tone="light" fade="left" />
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-midnight">
        <RookMark tone="gold" size={20} className="animate-pulse" />
      </span>
      <span className="relative">
        <span className="font-semibold text-midnight">{stage}…</span> {children}
      </span>
    </div>
  );
}

/** Empty state: board texture, the Midnight rook at full strength, a title and one helpful sentence. */
export function RookEmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="relative flex items-start gap-3.5 overflow-hidden rounded-[var(--radius-md)] border border-dashed border-line-strong bg-board px-5 py-5 text-sm">
      <RookChessPattern tone="light" fade="left" />
      <RookMark tone="midnight" size={22} className="relative mt-0.5" />
      <div className="relative">
        <p className="font-semibold text-midnight">{title}</p>
        {children ? <div className="mt-1 text-muted">{children}</div> : null}
      </div>
    </div>
  );
}

/** Error / notice: what failed, whether to act, what remains. Thin edge for severity; never a red background. */
export function RookErrorState({
  icon = "risk",
  tone = "risk",
  title,
  children,
}: {
  icon?: IconName;
  tone?: "risk" | "neutral";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3.5 rounded-[var(--radius-md)] border border-line bg-surface px-5 py-5 text-sm shadow-[var(--shadow-card)] ${tone === "risk" ? "border-l-2 border-l-risk" : ""}`}
    >
      <RookIcon name={icon} size={20} className={`mt-0.5 ${tone === "risk" ? "text-risk" : "text-midnight"}`} />
      <div>
        <p className="font-semibold text-midnight">{title}</p>
        {children ? <div className="mt-1 space-y-1 text-muted">{children}</div> : null}
      </div>
    </div>
  );
}
