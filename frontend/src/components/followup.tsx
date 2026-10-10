"use client";

import { useId, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { ActionProposal } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { RookButton, RookIcon } from "./rook";
import { ClaimBadge } from "./trust";

const TONES = ["executive", "concise", "diplomatic", "direct", "collaborative", "formal"] as const;

/**
 * Human-controlled follow-up (C-001, ADR-0005): ROOK prepares a draft with its supporting context;
 * nothing is sent unless the user explicitly approves this specific draft.
 */
export function FollowupLauncher({ commitmentId, riskId, label = "Draft follow-up" }: { commitmentId: number; riskId?: number; label?: string }) {
  const [draft, setDraft] = useState<ActionProposal | null>(null);
  const [tone, setTone] = useState<string>("executive");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toneId = useId();

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setDraft(await api.draftFollowup(commitmentId, { tone, riskId }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ROOK couldn't prepare the draft.");
    } finally {
      setBusy(false);
    }
  }

  if (draft) return <FollowupDraft initial={draft} onClose={() => setDraft(null)} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={toneId} className="sr-only">
        Tone
      </label>
      <select id={toneId} value={tone} onChange={(e) => setTone(e.target.value)} className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-2.5 py-2 text-[13px] font-medium text-midnight">
        {TONES.map((t) => (
          <option key={t} value={t}>
            {t[0].toUpperCase() + t.slice(1)} tone
          </option>
        ))}
      </select>
      <RookButton variant="strategic" icon="send" onClick={create} disabled={busy}>
        {busy ? "Preparing draft…" : label}
      </RookButton>
      {error ? (
        <p role="alert" className="w-full text-sm text-[var(--risk-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FollowupDraft({ initial, onClose }: { initial: ActionProposal; onClose?: () => void }) {
  const [p, setP] = useState(initial);
  const [subject, setSubject] = useState(initial.payload.subject);
  const [body, setBody] = useState(initial.payload.body);
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { subject: useId(), body: useId(), heading: useId() };
  const editable = p.status === "draft";
  const dirty = subject !== p.payload.subject || body !== p.payload.body;

  async function run(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      let current = p;
      if (kind === "approve" && dirty) current = await api.editAction(p.id, { subject, body });
      setP(kind === "approve" ? await api.approveAction(current.id) : await api.rejectAction(current.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ROOK couldn't complete that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={ids.heading} className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-raised)]">
      <div className="rook-dark flex flex-wrap items-center gap-x-3 gap-y-2 bg-midnight px-5 py-3.5">
        <RookIcon name="send" size={17} className="text-gold" />
        <h3 id={ids.heading} className="text-[14px] font-semibold text-on-dark">
          {p.title}
        </h3>
        <ClaimBadge type="RECOMMENDATION" />
        <span className="ml-auto text-[12px] text-on-dark-muted">Status: {p.status}</span>
      </div>
      <div className="p-5">
      {editable ? (
        <p className="flex items-center gap-2.5 border-l-2 border-gold bg-sunken px-3.5 py-2.5 text-[13px] font-medium text-midnight">
          <RookIcon name="lock" size={16} className="text-gold-deep" />
          Nothing is sent until you approve. Review and edit the draft below.
        </p>
      ) : null}

      {p.payload.context ? (
        <div className="mt-4 text-sm">
          <p className="text-[12px] font-semibold text-midnight">Why ROOK suggests this</p>
          <p className="mt-1 leading-relaxed text-ink-soft">{p.payload.context.why}</p>
          <div className="mt-2">
            <EvidenceList evidence={p.payload.context.evidence} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 text-sm">
        <p>
          <span className="text-[12px] font-semibold text-muted">To</span>{" "}
          <span className="text-midnight">{p.payload.to.length ? p.payload.to.join(", ") : <em>recipient unknown</em>}</span>
        </p>
        <div>
          <label htmlFor={ids.subject} className="block text-[12px] font-semibold text-muted">
            Subject
          </label>
          <input
            id={ids.subject}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2 text-midnight"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
          />
        </div>
        <div>
          <label htmlFor={ids.body} className="block text-[12px] font-semibold text-muted">
            Message
          </label>
          <textarea
            id={ids.body}
            rows={8}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2 font-[inherit] leading-relaxed text-midnight"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
          />
        </div>
      </div>

      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <RookButton variant="primary" icon="checkCircle" onClick={() => run("approve")} disabled={!!busy}>
            {busy === "approve" ? "Approving…" : "Approve and send"}
          </RookButton>
          <RookButton variant="quiet" onClick={() => run("reject")} disabled={!!busy}>
            {busy === "reject" ? "Discarding…" : "Discard draft"}
          </RookButton>
          {onClose ? (
            <RookButton variant="quiet" onClick={onClose} disabled={!!busy}>
              Close
            </RookButton>
          ) : null}
        </div>
      ) : (
        <p role="status" className="mt-4 border-l-2 border-success pl-3 text-sm">
          <span className="font-semibold text-midnight">{p.status === "executed" ? "Sent." : p.status === "rejected" ? "Draft discarded." : p.status === "blocked" ? "Blocked by policy." : "Approved."}</span>{" "}
          <span className="text-muted">{p.result}</span>
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--risk-ink)]">
          {error}
        </p>
      ) : null}
      </div>
    </section>
  );
}
