import Link from "next/link";
import type { ReactNode } from "react";

import type { ApiError } from "@/lib/api";
import type { ApiState } from "@/lib/useApi";

/** Progressive loading copy (UX §13): never a blank screen. */
export function Loading({ stage = "Preparing", what }: { stage?: "Connecting" | "Syncing" | "Analyzing" | "Preparing"; what?: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">
      <span className="font-medium text-ink">{stage}…</span> {what ?? "ROOK is assembling this view from your connected sources."}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-5 text-sm">
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </div>
  );
}

export function PermissionDenied({ what = "this item" }: { what?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-line bg-surface px-4 py-5 text-sm">
      <p className="font-medium text-ink">You don&apos;t have access to {what}.</p>
      <p className="mt-1 text-muted">
        ROOK only shows information you can open in the original system. If you believe you should have access, ask the
        owner of the source to share it with you.
      </p>
    </div>
  );
}

/** Errors say what failed, whether the user needs to act, and whether partial information remains (UX §14). */
export function ErrorState({ error, onRetry, what }: { error: ApiError; onRetry?: () => void; what?: string }) {
  if (error.kind === "forbidden") return <PermissionDenied what={what} />;
  if (error.kind === "not_found") {
    return (
      <div role="alert" className="rounded-lg border border-line bg-surface px-4 py-5 text-sm">
        <p className="font-medium text-ink">{what ? `${what[0].toUpperCase()}${what.slice(1)}` : "This item"} isn&apos;t available.</p>
        <p className="mt-1 text-muted">It may not exist, or it comes from a source you can&apos;t open. <Link className="text-accent underline" href="/">Back to Home</Link></p>
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-lg border border-[var(--high-bg)] bg-surface px-4 py-5 text-sm">
      <p className="font-medium text-ink">Couldn&apos;t load {what ?? "this view"}.</p>
      <p className="mt-1 text-muted">{error.message}</p>
      <p className="mt-1 text-muted">
        {error.actionRequired ? "Action needed from you. " : "No action needed from you. "}
        {error.partialData || "Nothing you have already seen has been lost."}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 rounded border border-line px-3 py-1.5 text-sm font-medium hover:bg-bg">
          Try again
        </button>
      ) : null}
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
