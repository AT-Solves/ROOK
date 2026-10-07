"use client";

import { useId, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { AskAnswer, Claim } from "@/lib/types";

import { RecommendationClaim } from "./actions";
import { EvidenceList, SourceLine } from "./evidence";
import { ClaimBadge, ConfidenceLabel } from "./trust";
import { primaryButtonClass } from "./ui";

export const MVP_QUESTIONS = [
  "What changed and what should I do?",
  "What needs my attention?",
  "What changed?",
  "What decisions are pending?",
  "What am I waiting for?",
  "What commitments are overdue?",
  "Prepare me for my next meeting.",
  "What is at risk?",
];

export function AskForm({ onAnswer, compact = false }: { onAnswer: (a: AskAnswer) => void; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function submit(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onAnswer(await api.ask(question.trim()));
      setQ("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ROOK couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask ROOK a question
        </label>
        <input
          id={inputId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask ROOK — e.g. “What changed and what should I do?”"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
          maxLength={1000}
        />
        <button type="submit" className={primaryButtonClass} disabled={busy || !q.trim()}>
          {busy ? "Analyzing…" : "Ask"}
        </button>
      </form>
      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {MVP_QUESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => submit(s)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:bg-bg"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="mt-2 text-sm text-muted">
          Analyzing your permitted sources…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--high-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ClaimList({ title, claims, id }: { title: string; claims: Claim[]; id: string }) {
  if (!claims.length) return null;
  return (
    <section aria-labelledby={id} className="mt-4">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {claims.map((c, i) => (
          <li key={i} className="rounded-md border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              <ClaimBadge type={c.claim_type} />
              <div className="min-w-0">
                <p className="text-sm text-ink">{c.text}</p>
                {c.meta ? <p className="text-xs text-muted">{c.meta}</p> : null}
              </div>
            </div>
            {c.detail ? <p className="mt-1 text-sm text-muted">{c.detail}</p> : null}
            {c.evidence.length ? (
              <div className="mt-1">
                <EvidenceList evidence={c.evidence} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Structured answer (UX §5): direct answer → key points → recommended action → evidence → sources. */
export function AnswerView({ a }: { a: AskAnswer }) {
  const base = useId();
  const keyPoints = a.what_changed.length || a.why_it_matters.length ? [] : a.key_points;
  return (
    <article aria-labelledby={`${base}-q`} className="rounded-lg border border-line bg-surface p-5">
      <p id={`${base}-q`} className="text-xs font-medium uppercase tracking-wide text-muted">
        {a.question}
      </p>
      <div className="mt-2 flex items-start gap-2">
        <ClaimBadge type={a.claim_type} className="mt-0.5" />
        <p className="text-[15px] leading-relaxed text-ink">{a.answer}</p>
      </div>
      <p className="mt-1 pl-1">
        <ConfidenceLabel value={a.confidence} />
      </p>

      <ClaimList title="What changed" claims={a.what_changed} id={`${base}-wc`} />
      <ClaimList title="Why it matters" claims={a.why_it_matters} id={`${base}-why`} />
      <ClaimList title="Key points" claims={keyPoints.slice(0, 8)} id={`${base}-kp`} />

      {a.recommended_actions.length ? (
        <section aria-labelledby={`${base}-rec`} className="mt-4">
          <h3 id={`${base}-rec`} className="text-xs font-semibold uppercase tracking-wide text-muted">
            Recommended action
          </h3>
          <ul className="mt-2 space-y-2">
            {a.recommended_actions.map((r, i) => (
              <RecommendationClaim key={i} claim={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {a.sources.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
            Sources · {a.sources.length}
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-line pl-3">
            {a.sources.map((s) => (
              <SourceLine key={s.signal_id} e={s} />
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
