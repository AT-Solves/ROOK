"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { ContextOverviewView } from "@/components/context";
import { RookPageHeader } from "@/components/rook";
import { StateGate } from "@/components/states";
import { ApiError, api } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { useSearchParam } from "@/lib/location";
import { useApi } from "@/lib/useApi";

type FirstSync = { phase: "running" } | { phase: "done" | "failed"; text: string };

/**
 * The first sync after connecting Microsoft 365. The OAuth return lands here as ?connected=microsoft365&id=N; that
 * event runs the existing sync once. The parameters are removed from the address straight away, so a refresh or Back
 * cannot run it again, and a ref keeps React's development-mode double effect from sending a second request.
 * A failure is shown once and never retried; "Sync now" stays available.
 */
function useFirstSync(onFinished: () => void): FirstSync | null {
  const [first, setFirst] = useState<FirstSync | null>(null);
  const handled = useRef(false);
  const finished = useEffectEvent(onFinished);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const url = new URL(window.location.href);
    const id = Number(url.searchParams.get("id"));
    if (url.searchParams.get("connected") !== "microsoft365" || !Number.isInteger(id) || id <= 0) return;
    url.searchParams.delete("connected");
    url.searchParams.delete("id");
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("rook:urlchange"));
    queueMicrotask(() => setFirst({ phase: "running" }));
    api
      .syncSource(id)
      .then((r) => setFirst({ phase: "done", text: `Microsoft 365 connected and synchronized: ${pluralize(r.signals_new, "new item")}, ${pluralize(r.meetings_upserted, "meeting")}.` }))
      .catch((e: unknown) =>
        setFirst({ phase: "failed", text: `Microsoft 365 is connected, but the first sync didn't complete: ${e instanceof ApiError ? e.message : "the sync failed."} Use Sync now to try again.` }),
      )
      .finally(() => finished());
  }, []);
  return first;
}

/**
 * Context Control Center (M3.5 P0-2/P0-3): what ROOK is connected to, what it can understand, with which permissions,
 * how fresh it is, and how complete your context is. Source provenance stays first-class: every source shows its account,
 * permissions, data types and sync state. Sources that are not built yet are listed without any Connect action.
 */
export default function ContextPage() {
  const state = useApi(() => api.context());
  const connected = useSearchParam("connected");
  const first = useFirstSync(state.reload);
  return (
    <>
      <RookPageHeader
        eyebrow="Context Control Center"
        title="Context"
        tagline="ROOK continuously builds context from the systems your organization already uses."
        meta={<span className="text-on-dark-muted">Every insight links back to the source it came from. ROOK reads only what you can already access.</span>}
      />
      {first ? (
        <p
          role={first.phase === "failed" ? "alert" : "status"}
          className={`mb-6 rounded-[var(--radius-md)] border border-line border-l-2 ${first.phase === "failed" ? "border-l-risk" : "border-l-success"} bg-surface p-3.5 text-sm text-midnight shadow-[var(--shadow-card)]`}
        >
          {first.phase === "running" ? "Microsoft 365 connected. ROOK is syncing your calendar and mail…" : first.text}
        </p>
      ) : connected && connected !== "microsoft365" ? (
        <p role="status" className="mb-6 rounded-[var(--radius-md)] border border-line border-l-2 border-l-success bg-surface p-3.5 text-sm text-midnight shadow-[var(--shadow-card)]">
          Connected. Run a sync to bring in the mail, calendar and meeting information you can access.
        </p>
      ) : null}
      <StateGate state={state} what="your context" stage="Connecting">
        {(ctx) => <ContextOverviewView ctx={ctx} onChange={state.reload} />}
      </StateGate>
    </>
  );
}
