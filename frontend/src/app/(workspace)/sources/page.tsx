"use client";

import { useState } from "react";

import { Empty, StateGate } from "@/components/states";
import { FeatureTile, type IconName } from "@/components/icons";
import { Button, PageHeader, Section } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useSearchParam } from "@/lib/location";
import type { SourceCatalogItem, SyncReport } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/**
 * Sources (UX §3, §13): connected systems and their sync state. Only connectors that exist are actionable;
 * planned connectors are listed as "planned" without fake controls.
 */
export default function SourcesPage() {
  const state = useApi(() => api.sources());
  const notice = useSearchParam("connected")
    ? "Connected. Run a sync to bring in your permitted mail, calendar and meeting information."
    : null;
  return (
    <>
      <PageHeader module="sources" title="Sources" subtitle="ROOK reads only what you can access in each system, and keeps each item's original permissions." />
      {notice ? <p role="status" className="mb-6 rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-success bg-surface p-3 text-sm shadow-[var(--shadow-card)]">{notice}</p> : null}
      <StateGate state={state} what="your sources" stage="Connecting">
        {(items) => {
          const available = items.filter((s) => s.phase <= 1 && s.kind !== "manual");
          const planned = items.filter((s) => s.phase > 1);
          return (
            <>
              <Section title="Available" id="s-available" count={available.length} icon="database">
                <ul className="space-y-3">{available.map((s) => <SourceRow key={s.kind} s={s} onChange={state.reload} />)}</ul>
              </Section>
              <Section title="Planned" id="s-planned" count={planned.length} icon="clock">
                <p className="text-sm text-muted">{planned.map((p) => p.name).join(", ")} — not available in this version.</p>
              </Section>
            </>
          );
        }}
      </StateGate>
    </>
  );
}

const SOURCE_ICON: Record<string, IconName> = { microsoft365: "email", demo: "database", manual: "document" };

function SourceRow({ s, onChange }: { s: SourceCatalogItem; onChange: () => void }) {
  const [stage, setStage] = useState<null | "Connecting" | "Syncing">(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const conn = s.connection;

  async function connect() {
    setStage("Connecting");
    setError(null);
    try {
      const { authorization_url } = await api.connectDelegated(s.kind);
      window.location.assign(authorization_url);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("server", "Couldn't start the connection."));
      setStage(null);
    }
  }
  async function sync() {
    if (!conn) return;
    setStage("Syncing");
    setError(null);
    try {
      setReport(await api.syncSource(conn.id));
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("server", "Sync failed."));
    } finally {
      setStage(null);
    }
  }

  const status = conn ? { connected: "Connected", needs_reauth: "Needs reconnecting", needs_configuration: "Needs configuration", disconnected: "Disconnected" }[conn.status] ?? conn.status : "Not connected";
  return (
    <li className="lift rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FeatureTile name={SOURCE_ICON[s.kind] ?? "database"} size={40} />
          <div>
          <p className="font-semibold text-midnight">{s.name}</p>
          <p className="text-xs text-muted">
            {status}
            {conn?.last_synced_at ? ` · last synced ${formatDateTime(conn.last_synced_at)}` : ""}
            {s.delegated ? " · connected per user, with your own access" : ""}
          </p>
          </div>
        </div>
        <div className="flex gap-2">
          {s.delegated && (!conn || conn.status !== "connected") ? (
            s.credentials_present ? (
              <Button variant="primary" icon="related" onClick={connect} disabled={!!stage}>{stage === "Connecting" ? "Connecting…" : conn ? "Reconnect" : "Connect"}</Button>
            ) : (
              <span className="text-xs text-muted">Not configured on this server (administrator setup required)</span>
            )
          ) : null}
          {conn && conn.status === "connected" ? (
            <Button variant="action" icon="refresh" onClick={sync} disabled={!!stage}>{stage === "Syncing" ? "Syncing…" : "Sync now"}</Button>
          ) : null}
        </div>
      </div>
      {stage ? <p role="status" className="mt-2 text-sm text-muted">{stage === "Syncing" ? "Syncing… then Analyzing new information." : "Connecting…"}</p> : null}
      {report ? (
        <div role="status" className="mt-2 text-sm">
          <p>
            <span className="font-medium">Ready.</span> {report.signals_new} new items, {report.meetings_upserted} meetings, {report.decisions_new} decisions, {report.commitments_new} commitments; {report.risks_open} open risks.
          </p>
          {report.warnings.length ? <ul className="mt-1 list-disc pl-5 text-muted">{report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-2 text-sm">
          <p className="font-medium">{s.name}: {error.message}</p>
          <p className="text-muted">{error.actionRequired ? "Action needed: reconnect this source." : "No action needed."} {error.partialData || "Previously synced information remains available."}</p>
        </div>
      ) : null}
      {!s.delegated && !conn ? <Empty title="Not connected." /> : null}
    </li>
  );
}
