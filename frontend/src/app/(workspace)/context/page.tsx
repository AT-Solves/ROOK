"use client";

import { ContextOverviewView } from "@/components/context";
import { RookPageHeader } from "@/components/rook";
import { StateGate } from "@/components/states";
import { api } from "@/lib/api";
import { useSearchParam } from "@/lib/location";
import { useApi } from "@/lib/useApi";

/**
 * Context Control Center (M3.5 P0-2/P0-3): what ROOK is connected to, what it can understand, with which permissions,
 * how fresh it is, and how complete your context is. Source provenance stays first-class: every source shows its account,
 * permissions, data types and sync state. Sources that are not built yet are listed without any Connect action.
 */
export default function ContextPage() {
  const state = useApi(() => api.context());
  const connected = useSearchParam("connected");
  return (
    <>
      <RookPageHeader
        eyebrow="Context Control Center"
        title="Context"
        tagline="ROOK continuously builds context from the systems your organization already uses."
        meta={<span className="text-on-dark-muted">Every insight links back to the source it came from. ROOK reads only what you can already access.</span>}
      />
      {connected ? (
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
