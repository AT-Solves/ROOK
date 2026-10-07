import Link from "next/link";
import type { ReactNode } from "react";

import type { ApiError } from "@/lib/api";
import type { ApiState } from "@/lib/useApi";

import { RookMark } from "./brand";
import { Icon } from "./icons";
import { Button } from "./ui";

/** Progressive loading copy (UX §13): never a blank screen. */
export function Loading({ stage = "Preparing", what }: { stage?: "Connecting" | "Syncing" | "Analyzing" | "Preparing"; what?: string }) {
  return (
    <div role="status" aria-live="polite" className="board-light flex items-center gap-3 rounded-[var(--radius-md)] border border-line px-4 py-6 text-sm text-muted">
      <RookMark tone="midnight" size={22} className="animate-pulse" />
      <span>
        <span className="font-semibold text-midnight">{stage}…</span> {what ?? "ROOK is assembling this view from your connected sources."}
      </span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="board-light flex items-start gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong px-4 py-5 text-sm">
      <RookMark tone="midnight" size={20} className="mt-0.5 opacity-60" />
      <div>
        <p className="font-medium text-midnight">{title}</p>
        {children ? <div className="mt-1 text-muted">{children}</div> : null}
      </div>
    </div>
  );
}

export function PermissionDenied({ what = "this item" }: { what?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-5 text-sm shadow-[var(--shadow-card)]">
      <Icon name="lock" size={20} accent className="mt-0.5 text-midnight" />
      <div>
        <p className="font-semibold text-midnight">You don&apos;t have access to {what}.</p>
        <p className="mt-1 text-muted">
          ROOK only shows information you can open in the original system. If you believe you should have access, ask the
          owner of the source to share it with you.
        </p>
      </div>
    </div>
  );
}

/** Errors say what failed, whether the user needs to act, and whether partial information remains (UX §14). */
export function ErrorState({ error, onRetry, what }: { error: ApiError; onRetry?: () => void; what?: string }) {
  if (error.kind === "forbidden") return <PermissionDenied what={what} />;
  if (error.kind === "not_found") {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-5 text-sm shadow-[var(--shadow-card)]">
        <Icon name="search" size={20} accent className="mt-0.5 text-midnight" />
        <div>
          <p className="font-semibold text-midnight">{what ? `${what[0].toUpperCase()}${what.slice(1)}` : "This item"} isn&apos;t available.</p>
          <p className="mt-1 text-muted">
            It may not exist, or it comes from a source you can&apos;t open.{" "}
            <Link className="font-medium text-midnight underline" href="/">
              Back to Home
            </Link>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-risk bg-surface px-4 py-5 text-sm shadow-[var(--shadow-card)]">
      <Icon name="risk" size={20} className="mt-0.5 text-risk" />
      <div>
        <p className="font-semibold text-midnight">Couldn&apos;t load {what ?? "this view"}.</p>
        <p className="mt-1 text-muted">{error.message}</p>
        <p className="mt-1 text-muted">
          {error.actionRequired ? "Action needed from you. " : "No action needed from you. "}
          {error.partialData || "Nothing you have already seen has been lost."}
        </p>
        {onRetry ? (
          <Button variant="action" icon="refresh" onClick={onRetry} className="mt-3">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Renders loading / error / empty / content for an ApiState, consistently across screens. */
export function StateGate<T>({
  state,
  what,
  stage,
  isEmpty,
  empty,
  children,
}: {
  state: ApiState<T>;
  what: string;
  stage?: "Connecting" | "Syncing" | "Analyzing" | "Preparing";
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.loading && !state.data) return <Loading stage={stage} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} what={what} />;
  if (!state.data) return null;
  if (isEmpty?.(state.data)) return <>{empty}</>;
  return <>{children(state.data)}</>;
}
