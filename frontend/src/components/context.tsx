"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { formatDateTime, pluralize } from "@/lib/format";
import type { AccessStatus, ContextHealth, ContextOverview, ContextSource, ContextType, DataAccess, LaterGroup } from "@/lib/types";

import { RookButton, RookIcon, RookSection, RookSourceIcon, type IconName } from "./rook";
import { ClaimBadge } from "./trust";

/*
 * Context Control Center (M3.5 P0-2/P0-3). Presentation only: every value — access per kind of data, health, the
 * actions offered — comes from GET /api/context, which derives it from real connector state and from items the
 * signed-in user can open. Status is always words plus an icon, never colour alone.
 */

export function ContextOverviewView({ ctx, onChange }: { ctx: ContextOverview; onChange: () => void }) {
  const connected = ctx.sources.filter((s) => s.state === "connected");
  const available = ctx.sources.filter((s) => s.state === "available");
  return (
    <>
      <HealthPanel h={ctx.health} types={ctx.context_types} />
      <RookSection title="Connected" id="c-connected" count={connected.length} icon="database">
        {connected.length ? (
          <ul className="space-y-6">{connected.map((s) => <ConnectedSource key={s.kind} s={s} onChange={onChange} />)}</ul>
        ) : (
          <p className="border-l-2 border-gold py-1 pl-4 text-[14px] text-ink-soft">
            No organizational source is connected yet. Connect one below so ROOK can start building context.
          </p>
        )}
      </RookSection>
      {available.length ? (
        <RookSection title="Available" id="c-available" count={available.length} icon="related">
          <ul className="space-y-4">{available.map((s) => <AvailableSource key={s.kind} s={s} />)}</ul>
        </RookSection>
      ) : null}
      <LaterList groups={ctx.available_later} />
    </>
  );
}

/* ---------------------------------------------------------------- health */

const HEALTH_MARK: Record<ContextHealth["state"], { icon: IconName; color: string }> = {
  strong: { icon: "checkCircle", color: "text-success" },
  partial: { icon: "risk", color: "text-warning" },
  limited: { icon: "risk", color: "text-risk" },
  not_connected: { icon: "lock", color: "text-chess" },
};

export function HealthPanel({ h, types }: { h: ContextHealth; types: Record<ContextType, string> }) {
  const mark = HEALTH_MARK[h.state];
  const facts = h.reasons.filter((r) => r.kind === "access");
  const limits = h.reasons.filter((r) => r.kind === "limitation");
  return (
    <RookSection title="Context health" id="c-health" icon="insight">
      <div className="rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-line px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-midnight">
              <RookIcon name={mark.icon} size={18} className={mark.color} />
              {h.label}
            </span>
            <ClaimBadge type={h.claim_type} />
            {h.synthetic ? <span className="text-[12px] font-semibold text-gold-deep">Includes synthetic data</span> : null}
          </div>
          <p className="rook-display mt-2 text-[1.4rem] leading-snug text-midnight">{h.summary}</p>
          <dl aria-label="What ROOK can access" className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-[13px]">
            {(Object.keys(types) as ContextType[]).map((t) => (
              <div key={t} className="flex items-baseline gap-1.5">
                <dt className="text-muted">{types[t]}</dt>
                <dd className="font-semibold tabular-nums text-midnight">{h.coverage[t] ? h.coverage[t] : "none"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          <ReasonList title="What ROOK can access" items={facts} />
          <ReasonList title="Limitations" items={limits} empty="No limitations: every connected source is current and fully permitted." border />
        </div>
      </div>
    </RookSection>
  );
}

function ReasonList({ title, items, empty, border = false }: { title: string; items: ContextHealth["reasons"]; empty?: string; border?: boolean }) {
  return (
    <div className={`px-5 py-4 md:px-6 ${border ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
      <h3 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[var(--tracking-caps)] text-ink-soft">
        {title}
        {items.length ? <ClaimBadge type={items[0].claim_type} /> : null}
      </h3>
      {items.length ? (
        <ul className="space-y-1.5 text-[13.5px] text-ink-soft">
          {items.map((r, i) => <li key={i}>{r.text}</li>)}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">{empty}</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- connected source */

const CONNECTION: Record<string, { label: string; icon: IconName; color: string }> = {
  connected: { label: "Connected", icon: "checkCircle", color: "text-success" },
  needs_reauth: { label: "Needs reconnecting", icon: "risk", color: "text-risk" },
  needs_configuration: { label: "Needs configuration", icon: "risk", color: "text-warning" },
  disconnected: { label: "Disconnected", icon: "lock", color: "text-chess" },
};
const ACCESS_MARK: Record<AccessStatus, { icon: IconName; color: string }> = {
  available: { icon: "checkCircle", color: "text-success" },
  granted: { icon: "clock", color: "text-chess" },
  not_granted: { icon: "risk", color: "text-warning" },
  admin_required: { icon: "risk", color: "text-warning" },
  disabled: { icon: "lock", color: "text-chess" },
  unavailable: { icon: "risk", color: "text-warning" },
  disconnected: { icon: "lock", color: "text-chess" },
};
const SOURCE_ICON: Record<string, IconName> = { microsoft365: "email", demo: "database", manual: "document" };
const ITEM_NOUN: Record<ContextType, string> = { meetings: "meeting", conversations: "conversation", transcripts: "transcript", work_items: "work item", documents: "document" };

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 md:px-6">
      <h4 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[var(--tracking-caps)] text-muted">{title}</h4>
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 py-1 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-midnight">{children}</dd>
    </div>
  );
}

export function AccessList({ access }: { access: DataAccess[] }) {
  return (
    <ul className="space-y-2.5">
      {access.map((a) => {
        const m = ACCESS_MARK[a.status];
        return (
          <li key={a.key} className="text-[13px]">
            <span className="flex items-start gap-2">
              <RookIcon name={m.icon} size={16} className={`mt-px shrink-0 ${m.color}`} />
              <span>
                <span className="font-semibold text-midnight">{a.label}</span>
                <span className="text-ink-soft"> — {a.status_label}</span>
                {a.ok ? null : <span className="mt-0.5 block text-[12.5px] text-muted">{a.reason}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ConnectedSource({ s, onChange }: { s: ContextSource; onChange: () => void }) {
  const c = s.connection!;
  const [busy, setBusy] = useState<null | "sync" | "reconnect" | "disconnect">(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const status = CONNECTION[c.status] ?? { label: c.status, icon: "status" as IconName, color: "text-chess" };
  const can = (a: "sync" | "reconnect" | "disconnect") => c.actions.includes(a);
  const readable = (Object.entries(c.visible_items) as [ContextType, number][]).filter(([, n]) => n > 0);

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
      <article aria-labelledby={`src-${s.kind}`} className="rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-6">
          <div className="flex items-start gap-3.5">
            <RookSourceIcon icon={SOURCE_ICON[s.kind] ?? "database"} size={40} />
            <div>
              <h3 id={`src-${s.kind}`} className="text-[17px] font-semibold text-midnight">{s.name}</h3>
              <p className="text-[12.5px] text-muted">{s.data_types.map((d) => d.label).join(" · ")}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-midnight">
                  <RookIcon name={status.icon} size={15} className={status.color} />
                  {status.label}
                </span>
                <span className="text-ink-soft">Account: {c.account}</span>
                {s.synthetic ? <span className="font-semibold text-gold-deep">Synthetic data</span> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can("sync") ? (
              <RookButton variant="secondary" icon="refresh" onClick={() => run("sync")} disabled={!!busy}>
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </RookButton>
            ) : null}
            {can("reconnect") ? (
              <RookButton variant="secondary" icon="related" onClick={() => run("reconnect")} disabled={!!busy}>
                Reconnect
              </RookButton>
            ) : null}
            {can("disconnect") ? (
              confirm ? (
                <>
                  <RookButton variant="primary" onClick={() => run("disconnect")} disabled={!!busy}>
                    {busy === "disconnect" ? "Disconnecting…" : "Confirm disconnect"}
                  </RookButton>
                  <RookButton variant="quiet" onClick={() => setConfirm(false)} disabled={!!busy}>Cancel</RookButton>
                </>
              ) : (
                <RookButton variant="quiet" onClick={() => setConfirm(true)} disabled={!!busy}>Disconnect</RookButton>
              )
            ) : null}
          </div>
        </header>
        <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <Column title="Access">
            <AccessList access={c.access} />
          </Column>
          <Column title="Synchronization">
            <dl>
              <Fact label="Last attempted">{c.last_attempted_sync ? formatDateTime(c.last_attempted_sync) : "Never"}</Fact>
              <Fact label="Last successful">{c.last_successful_sync ? formatDateTime(c.last_successful_sync) : "Not yet"}</Fact>
              <Fact label="Result">
                {c.last_sync ? (
                  c.last_sync.ok ? (
                    <span className="inline-flex items-center gap-1.5"><RookIcon name="checkCircle" size={14} className="text-success" />Succeeded</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><RookIcon name="risk" size={14} className="text-risk" />Failed</span>
                  )
                ) : (
                  "No sync recorded"
                )}
              </Fact>
              {c.last_sync?.ok && c.last_sync.counts.signals_new !== undefined ? (
                <Fact label="Processed">
                  {pluralize(c.last_sync.counts.signals_new, "new item")}
                  {c.last_sync.counts.meetings !== undefined ? ` · ${pluralize(c.last_sync.counts.meetings, "meeting")}` : ""}
                </Fact>
              ) : null}
            </dl>
            <p className="mt-2 border-t border-line pt-2 text-[13px] text-ink-soft">
              <span className="text-muted">You can open: </span>
              {readable.map(([t, n]) => pluralize(n, ITEM_NOUN[t])).join(" · ") || "nothing yet"}
            </p>
            {c.last_sync && !c.last_sync.ok ? <p className="mt-2 border-l-2 border-risk pl-2.5 text-[12.5px] text-ink-soft">{c.last_sync.error}</p> : null}
            {c.last_sync?.warnings.length ? (
              <ul aria-label="Sync warnings" className="mt-2 space-y-1">
                {c.last_sync.warnings.map((w, i) => (
                  <li key={i} className="border-l-2 border-warning pl-2.5 text-[12.5px] text-ink-soft">{w}</li>
                ))}
              </ul>
            ) : null}
          </Column>
          <Column title="Permissions granted">
            {c.granted_permissions.length ? (
              <ul className="space-y-1.5 text-[13px]">
                {c.granted_permissions.map((p) => (
                  <li key={p.scope} className="text-ink-soft">
                    {p.label}
                    <code className="ml-1.5 text-[11px] text-muted">{p.scope}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-soft">{s.synthetic ? "None needed: synthetic data generated on this server." : "No delegated permissions recorded."}</p>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              ROOK uses only items you can open in the source. Sending: {s.sending}.
            </p>
          </Column>
        </div>
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={`border-t border-line px-5 py-3 text-[13px] md:px-6 ${message.ok ? "text-midnight" : "text-[var(--risk-ink)]"}`}>
            {message.text}
          </p>
        ) : null}
      </article>
    </li>
  );
}

/* ---------------------------------------------------------------- available / later */

export function AvailableSource({ s }: { s: ContextSource }) {
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
  const asks = s.requested_permissions.filter((p) => !["openid", "profile", "email"].includes(p.scope));
  return (
    <li>
      <article aria-labelledby={`avail-${s.kind}`} className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 md:px-6">
        <div className="flex items-start gap-3.5">
          <RookSourceIcon icon={SOURCE_ICON[s.kind] ?? "database"} size={40} />
          <div>
            <h3 id={`avail-${s.kind}`} className="text-[16px] font-semibold text-midnight">{s.name}</h3>
            <p className="text-[12.5px] text-muted">{s.data_types.map((d) => d.label).join(" · ")}</p>
            {s.connection?.status === "disconnected" ? <p className="mt-1.5 text-[12.5px] text-ink-soft">Disconnected. Information already synced remains available.</p> : null}
            {asks.length ? <p className="mt-2 text-[12.5px] text-ink-soft">Will ask for: {asks.map((p) => p.label).join(" · ")}.</p> : null}
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
      </article>
    </li>
  );
}

export function LaterList({ groups }: { groups: LaterGroup[] }) {
  return (
    <RookSection title="Available later" id="c-later" count={groups.length} icon="clock">
      <p className="mb-3 text-[13px] text-muted">Not built yet. ROOK does not connect to these until each integration is implemented and approved.</p>
      <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-sunken">
        {groups.map((g) => (
          <li key={g.name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3">
            <span>
              <span className="font-semibold text-midnight">{g.name}</span>
              {g.products.length > 1 || g.products[0] !== g.name ? <span className="ml-2 text-[13px] text-ink-soft">{g.products.join(" · ")}</span> : null}
            </span>
            <span className="text-[12.5px] text-muted">{g.data_types.join(" · ")} · Not available yet</span>
          </li>
        ))}
      </ul>
    </RookSection>
  );
}
