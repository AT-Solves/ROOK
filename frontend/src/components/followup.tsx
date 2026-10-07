"use client";

import { useId, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { ActionProposal } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { ClaimBadge } from "./trust";
import { buttonClass, primaryButtonClass } from "./ui";

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
      <select id={toneId} value={tone} onChange={(e) => setTone(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
        {TONES.map((t) => (
          <option key={t} value={t}>
            {t[0].toUpperCase() + t.slice(1)} tone
          </option>
        ))}
      </select>
      <button type="button" className={buttonClass} onClick={create} disabled={busy}>
        {busy ? "Preparing draft…" : label}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-[var(--high-ink)]">
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
    <section aria-labelledby={ids.heading} className="mt-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={ids.heading} className="text-sm font-semibold">
          {p.title}
        </h3>
        <ClaimBadge type="RECOMMENDATION" />
        <span className="text-xs text-muted">Status: {p.status}</span>
      </div>
      {editable ? (
        <p className="mt-2 rounded bg-[var(--rec-bg)] px-3 py-2 text-sm text-[var(--rec-ink)]">
          Nothing is sent until you approve. Review and edit the draft below.
        </p>
      ) : null}

      {p.payload.context ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">Why ROOK suggests this</p>
          <p className="mt-0.5 text-muted">{p.payload.context.why}</p>
          <div className="mt-1">
            <EvidenceList evidence={p.payload.context.evidence} />
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="text-muted">To:</span> {p.payload.to.length ? p.payload.to.join(", ") : <em>recipient unknown</em>}
        </p>
        <div>
          <label htmlFor={ids.subject} className="block text-xs font-medium text-muted">
            Subject
          </label>
          <input
            id={ids.subject}
            className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1.5"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
          />
        </div>
        <div>
          <label htmlFor={ids.body} className="block text-xs font-medium text-muted">
            Message
          </label>
          <textarea
            id={ids.body}
            rows={8}
            className="mt-0.5 w-full rounded-md border border-line bg-surface px-2 py-1.5 font-[inherit]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
          />
        </div>
      </div>

      {editable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} onClick={() => run("approve")} disabled={!!busy}>
            {busy === "approve" ? "Approving…" : "Approve and send"}
          </button>
          <button type="button" className={buttonClass} onClick={() => run("reject")} disabled={!!busy}>
            {busy === "reject" ? "Discarding…" : "Discard draft"}
          </button>
          {onClose ? (
            <button type="button" className={buttonClass} onClick={onClose} disabled={!!busy}>
              Close
            </button>
          ) : null}
        </div>
      ) : (
        <p role="status" className="mt-3 text-sm">
          <span className="font-medium">{p.status === "executed" ? "Sent." : p.status === "rejected" ? "Draft discarded." : p.status === "blocked" ? "Blocked by policy." : "Approved."}</span>{" "}
          <span className="text-muted">{p.result}</span>
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--high-ink)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
