import Link from "next/link";
import type { ReactNode } from "react";

import type { ApiError } from "@/lib/api";
import type { ApiState } from "@/lib/useApi";

import { RookButton, RookEmptyState, RookErrorState, RookLoadingState } from "./rook";

type Stage = "Connecting" | "Syncing" | "Analyzing" | "Preparing";

/** Progressive loading copy (UX §13): never a blank screen. */
export function Loading({ stage = "Preparing", what }: { stage?: Stage; what?: string }) {
  return <RookLoadingState stage={stage}>{what ?? "ROOK is assembling this view from your connected sources."}</RookLoadingState>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <RookEmptyState title={title}>{children}</RookEmptyState>;
}

export function PermissionDenied({ what = "this item" }: { what?: string }) {
  return (
    <RookErrorState icon="lock" tone="neutral" title={`You don't have access to ${what}.`}>
      <p>
        ROOK only shows information you can open in the original system. If you believe you should have access, ask the owner of
        the source to share it with you.
      </p>
    </RookErrorState>
  );
}

/** Errors say what failed, whether the user needs to act, and whether partial information remains (UX §14). */
export function ErrorState({ error, onRetry, what }: { error: ApiError; onRetry?: () => void; what?: string }) {
  if (error.kind === "forbidden") return <PermissionDenied what={what} />;
  if (error.kind === "not_found") {
    return (
      <RookErrorState icon="search" tone="neutral" title={`${what ? `${what[0].toUpperCase()}${what.slice(1)}` : "This item"} isn't available.`}>
        <p>
          It may not exist, or it comes from a source you can&apos;t open.{" "}
          <Link className="font-semibold text-midnight underline underline-offset-2" href="/">
            Back to Home
          </Link>
        </p>
      </RookErrorState>
    );
  }
  return (
    <RookErrorState title={`Couldn't load ${what ?? "this view"}.`}>
      <p>{error.message}</p>
      <p>
        {error.actionRequired ? "Action needed from you. " : "No action needed from you. "}
        {error.partialData || "Nothing you have already seen has been lost."}
      </p>
      {onRetry ? (
        <RookButton variant="secondary" icon="refresh" onClick={onRetry} className="mt-3">
          Try again
        </RookButton>
      ) : null}
    </RookErrorState>
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
  stage?: Stage;
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
