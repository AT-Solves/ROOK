"use client";

import { useState } from "react";

import { RookButton, RookCard, RookIcon, RookPageHeader, RookSection, RookSourceIcon, RookStatusBadge, type IconName, type RookStatusTone } from "@/components/rook";
import { StateGate } from "@/components/states";
import { ClaimBadge } from "@/components/trust";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, pluralize } from "@/lib/format";
import { useSearchParam } from "@/lib/location";
import type { ContextHealth, ContextOverview, ContextSource, ContextType } from "@/lib/types";
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
        {(ctx) => <Overview ctx={ctx} reload={state.reload} />}
      </StateGate>
    </>
  );
}

function Overview({ ctx, reload }: { ctx: ContextOverview; reload: () => void }) {
  const connected = ctx.sources.filter((s) => s.state === "connected");
  const available = ctx.sources.filter((s) => s.state === "available");
  const later = ctx.sources.filter((s) => s.state === "later");
  return (
    <>
      <Health h={ctx.health} types={ctx.context_types} />
      <RookSection title="Connected sources" id="c-connected" count={connected.length} icon="database">
        {connected.length ? (
          <ul className="space-y-4">{connected.map((s) => <SourceCard key={s.kind} s={s} onChange={reload} />)}</ul>
        ) : (
          <p className="rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 text-[14px] text-muted">No source is connected yet.</p>
        )}
      </RookSection>
      {available.length ? (
        <RookSection title="Available" id="c-available" count={available.length} icon="related">
          <ul className="space-y-4">{available.map((s) => <AvailableCard key={s.kind} s={s} />)}</ul>
        </RookSection>
      ) : null}
      <RookSection title="Available later" id="c-later" count={later.length} icon="clock">
        <p className="mb-3 text-[13px] text-muted">Not built yet. ROOK will not connect to these until each integration is implemented and approved.</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {later.map((s) => (
            <li key={s.kind} className="rounded-[var(--radius-md)] bg-sunken px-4 py-3">
              <p className="font-semibold text-midnight">{s.name}</p>
              <p className="text-[12px] text-muted">{s.data_types.map((d) => d.label).join(" · ") || s.category}</p>
              <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">Not available yet</p>
            </li>
          ))}
        </ul>
      </RookSection>
    </>
  );
}

/* ---------------------------------------------------------------- context health */

const HEALTH_TONE: Record<ContextHealth["state"], RookStatusTone> = { strong: "ok", partial: "warn", limited: "risk", not_connected: "neutral" };
const TYPE_ICON: Record<ContextType, IconName> = { meetings: "calendar", conversations: "chat", transcripts: "video", work_items: "status", documents: "document" };

function Health({ h, types }: { h: ContextHealth; types: Record<ContextType, string> }) {
  return (
    <RookSection title="Context health" id="c-health" icon="insight">
      <RookCard level={1}>
        <div className="flex flex-wrap items-center gap-3">
          <ClaimBadge type={h.claim_type} />
          <RookStatusBadge tone={HEALTH_TONE[h.state]}>{h.label}</RookStatusBadge>
          {h.synthetic ? <span className="rook-caps rounded-[var(--radius-xs)] bg-midnight px-2 py-1 text-[10px] text-gold">Includes synthetic data</span> : null}
        </div>
        <p className="rook-display mt-2.5 text-[1.45rem] text-midnight">{h.summary}</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="What ROOK can see">
          {(Object.keys(types) as ContextType[]).map((t) => (
            <li key={t} className="rounded-[var(--radius-sm)] border border-line bg-board px-3.5 py-3">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-muted">
                <RookIcon name={TYPE_ICON[t]} size={15} className="text-chess" />
                {types[t]}
              </span>
              <span className="mt-1 block text-[1.35rem] font-semibold tabular-nums text-midnight">{h.coverage[t] ? h.coverage[t] : "None"}</span>
            </li>
          ))}
        </ul>
        <details className="group mt-5" open>
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-midnight">
            <RookIcon name="chevronRight" size={13} strokeWidth={2.2} className="rook-disclosure text-gold-deep" />
            Why ROOK says this
          </summary>
          <ul className="mt-3 space-y-2">
            {h.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-ink-soft">
                <ClaimBadge type={r.claim_type} className="mt-0.5" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </details>
      </RookCard>
    </RookSection>
  );
}

/* ---------------------------------------------------------------- sources */

const STATUS: Record<string, { label: string; tone: RookStatusTone }> = {
  connected: { label: "Connected", tone: "ok" },
  needs_reauth: { label: "Needs reconnecting", tone: "risk" },
  needs_configuration: { label: "Needs configuration", tone: "warn" },
  disconnected: { label: "Disconnected", tone: "neutral" },
};
const SOURCE_ICON: Record<string, IconName> = { microsoft365: "email", demo: "database", manual: "document" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] text-ink-soft sm:mt-0">{children}</dd>
    </div>
  );
}

function SourceCard({ s, onChange }: { s: ContextSource; onChange: () => void }) {
  const c = s.connection!;
  const [busy, setBusy] = useState<null | "sync" | "reconnect" | "disconnect">(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const status = STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };

  async function run(kind: "sync" | "reconnect" | "disconnect") {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "reconnect") {
        window.location.assign((await api.connectDelegated(s.kind)).authorization_url);
        return;
      }
      if (kind === "sync") {
        const r = await api.syncSource(c.id);
        setMessage({ ok: true, text: `Synchronized: ${pluralize(r.signals_new, "new item")}, ${pluralize(r.meetings_upserted, "meeting")}.` });
      } else {
        await api.disconnectSource(c.id);
        setMessage({ ok: true, text: `${s.name} disconnected. Stored access was removed; information already synced remains available.` });
      }
      onChange();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "That didn't work." });
    } finally {
      setBusy(null);
      setConfirm(false);
    }
  }

  return (
    <li>
      <article aria-labelledby={`src-${s.kind}`} className="rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 md:px-6">
          <div className="flex items-start gap-3.5">
            <RookSourceIcon icon={SOURCE_ICON[s.kind] ?? "database"} size={42} />
            <div>
              <h3 id={`src-${s.kind}`} className="text-[16px] font-semibold text-midnight">{s.name}</h3>
              <p className="text-[12.5px] text-muted">{s.data_types.map((d) => d.label).join(" · ")}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <RookStatusBadge tone={status.tone}>{status.label}</RookStatusBadge>
                {s.synthetic ? <span className="text-[12px] font-semibold text-gold-deep">Synthetic data</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RookButton variant="secondary" icon="refresh" onClick={() => run("sync")} disabled={!!busy || c.status === "disconnected"}>
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </RookButton>
            {s.delegated ? (
              <RookButton variant="secondary" icon="related" onClick={() => run("reconnect")} disabled={!!busy || !s.connectable}>
                Reconnect
              </RookButton>
            ) : null}
            {s.delegated && c.status !== "disconnected" ? (
              confirm ? (
                <RookButton variant="primary" onClick={() => run("disconnect")} disabled={!!busy}>
                  {busy === "disconnect" ? "Disconnecting…" : "Confirm disconnect"}
                </RookButton>
              ) : (
                <RookButton variant="quiet" onClick={() => setConfirm(true)} disabled={!!busy}>
                  Disconnect
                </RookButton>
              )
            ) : null}
          </div>
        </div>
        <dl className="mt-3 px-5 pb-4 md:px-6">
          <Row label="Account">{c.account}</Row>
          <Row label="Last successful sync">{c.last_successful_sync ? formatDateTime(c.last_successful_sync) : "Not yet synchronized"}</Row>
          <Row label="Last sync result">
            {c.last_sync ? (
              c.last_sync.ok ? (
                <span>
                  Succeeded {formatDateTime(c.last_sync.at)}
                  {c.last_sync.counts.signals_new !== undefined ? ` · ${pluralize(c.last_sync.counts.signals_new, "new item")}` : ""}
                </span>
              ) : (
                <span className="text-[var(--risk-ink)]">Failed {formatDateTime(c.last_sync.at)}: {c.last_sync.error}</span>
              )
            ) : (
              "No sync recorded yet"
            )}
            {c.last_sync?.warnings.length ? (
              <ul className="mt-1.5 space-y-1">
                {c.last_sync.warnings.map((w, i) => (
                  <li key={i} className="border-l-2 border-warning pl-2.5 text-[12.5px]">{w}</li>
                ))}
              </ul>
            ) : null}
          </Row>
          <Row label="What ROOK can read">
            {(Object.entries(c.visible_items) as [ContextType, number][])
              .filter(([, n]) => n > 0)
              .map(([t, n]) => pluralize(n, t === "work_items" ? "work item" : t === "transcripts" ? "transcript" : t.replace(/s$/, "")))
              .join(" · ") || "Nothing yet"}
          </Row>
          <Row label="Permissions granted">
            {c.granted_permissions.length ? (
              <ul className="space-y-0.5">
                {c.granted_permissions.map((p) => (
                  <li key={p.scope}>
                    {p.label} <code className="ml-1 text-[11px] text-muted">{p.scope}</code>
                  </li>
                ))}
              </ul>
            ) : s.synthetic ? (
              "None — synthetic data generated on this server"
            ) : (
              "No delegated permissions recorded"
            )}
          </Row>
          <Row label="Limits">
            Only items you can open in {s.synthetic ? "the source" : s.name} are used; restricted items stay visible to their participants only.
            Sending: {s.sending}.
          </Row>
        </dl>
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={`mx-5 mb-5 border-l-2 pl-3 text-[13px] md:mx-6 ${message.ok ? "border-success text-midnight" : "border-risk text-[var(--risk-ink)]"}`}>
            {message.text}
          </p>
        ) : null}
      </article>
    </li>
  );
}

function AvailableCard({ s }: { s: ContextSource }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    setError(null);
    try {
      window.location.assign((await api.connectDelegated(s.kind)).authorization_url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start the connection.");
      setBusy(false);
    }
  }
  return (
    <li>
      <RookCard level={2} className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <RookSourceIcon icon={SOURCE_ICON[s.kind] ?? "database"} size={42} />
          <div>
            <h3 className="text-[16px] font-semibold text-midnight">{s.name}</h3>
            <p className="text-[12.5px] text-muted">{s.data_types.map((d) => d.label).join(" · ")}</p>
            <p className="mt-2 text-[12.5px] text-ink-soft">
              Will ask for: {s.requested_permissions.filter((p) => !["openid", "profile", "email"].includes(p.scope)).map((p) => p.label).join(" · ")}.
            </p>
            {s.setup_required ? (
              <p className="mt-2 border-l-2 border-gold pl-2.5 text-[12.5px] text-ink-soft">
                <span className="font-semibold text-midnight">Administrator setup required.</span> {s.name} is not configured on this server yet.
              </p>
            ) : null}
            {error ? <p role="alert" className="mt-2 text-[13px] text-[var(--risk-ink)]">{error}</p> : null}
          </div>
        </div>
        {s.connectable ? (
          <RookButton variant="primary" icon="related" onClick={connect} disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </RookButton>
        ) : null}
      </RookCard>
    </li>
  );
}
