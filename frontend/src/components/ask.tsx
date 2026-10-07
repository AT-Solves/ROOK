"use client";

import { useId, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { AskAnswer, Claim, ClaimType } from "@/lib/types";

import { ActionControl, RecommendationClaim } from "./actions";
import { RookMark } from "./brand";
import { EvidenceList, SourceLine } from "./evidence";
import { Icon, type IconName } from "./icons";
import { ClaimBadge, ConfidenceLabel } from "./trust";
import { Button } from "./ui";

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
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask ROOK a question
        </label>
        <div className="relative min-w-0 flex-1">
          <Icon name="search" size={18} accent className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chess" />
          <input
            id={inputId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask ROOK — e.g. “What changed and what should I do?”"
            className="w-full rounded-[10px] border border-line-strong bg-white py-2.5 pl-10 pr-3 text-sm text-midnight placeholder:text-chess"
            maxLength={1000}
          />
        </div>
        <Button type="submit" variant="primary" rook={<RookMark tone="gold" size={18} />} disabled={busy || !q.trim()}>
          {busy ? "Analyzing…" : "Ask ROOK"}
        </Button>
      </form>
      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {MVP_QUESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => submit(s)}
              className="lift rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-soft hover:border-gold hover:text-midnight"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted">
          <RookMark tone="midnight" size={16} className="animate-pulse" />
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

function RecommendationList({ claims, id }: { claims: Claim[]; id: string }) {
  if (!claims.length) return null;
  return (
    <section aria-labelledby={id} className="mt-4">
      <h3 id={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        Recommended action
      </h3>
      <ul className="mt-2 space-y-2">
        {claims.map((r, i) => (
          <RecommendationClaim key={i} claim={r} />
        ))}
      </ul>
    </section>
  );
}

function ClaimList({ title, claims, id }: { title: string; claims: Claim[]; id: string }) {
  if (!claims.length) return null;
  return (
    <section aria-labelledby={id} className="mt-4">
      <h3 id={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {claims.map((c, i) => (
          <li key={i} className="rounded-[var(--radius-md)] border border-line bg-surface p-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2.5">
              <ClaimBadge type={c.claim_type} className="self-start" />
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

/** Each claim type has its own heading, icon and edge — the four parts never rely on colour alone. */
const UNIT_STYLE: Record<ClaimType, { icon: IconName; edge: string }> = {
  FACT: { icon: "document", edge: "border-l-[var(--fact-dot)]" },
  INFERENCE: { icon: "insight", edge: "border-l-[var(--inf-dot)]" },
  RECOMMENDATION: { icon: "target", edge: "border-l-gold" },
  UNKNOWN: { icon: "search", edge: "border-l-[var(--unk-dot)] border-dashed" },
};

const UNIT_HEADING: Record<ClaimType, string> = {
  FACT: "What changed",
  INFERENCE: "Why it may matter",
  RECOMMENDATION: "What ROOK recommends",
  UNKNOWN: "What ROOK cannot establish",
};

/** Composite direct answer (C-008): one typed unit per kind of claim — never one label for the whole answer. */
function DirectUnits({ units, id }: { units: Claim[]; id: string }) {
  return (
    <ol aria-labelledby={id} className="mt-3 space-y-3">
      {units.map((u, i) => (
        <li key={i} className={`rounded-[var(--radius-md)] border border-line border-l-[3px] bg-surface p-3.5 shadow-[var(--shadow-card)] ${UNIT_STYLE[u.claim_type].edge}`} data-unit-type={u.claim_type}>
          <div className="flex flex-wrap items-center gap-2">
            <Icon name={UNIT_STYLE[u.claim_type].icon} size={16} accent className="text-midnight" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{UNIT_HEADING[u.claim_type]}</span>
            <ClaimBadge type={u.claim_type} />
            {u.claim_type !== "UNKNOWN" ? <ConfidenceLabel value={u.confidence} /> : null}
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{u.text}</p>
          {u.basis ? <p className="mt-0.5 text-xs text-muted">{u.basis}</p> : null}
          {u.evidence.length ? (
            <div className="mt-1">
              <EvidenceList evidence={u.evidence} label={u.claim_type === "RECOMMENDATION" ? "Based on" : "Source"} />
            </div>
          ) : null}
          {u.action ? (
            <div className="mt-2">
              <ActionControl action={u.action} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Structured answer (UX §5): direct answer → key points → recommended action → evidence → sources. */
export function AnswerView({ a }: { a: AskAnswer }) {
  const base = useId();
  const keyPoints = a.what_changed.length || a.why_it_matters.length ? [] : a.key_points;
  return (
    <article aria-labelledby={`${base}-q`} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 border-b border-line pb-3">
        <RookMark tone="midnight" size={20} />
        <p id={`${base}-q`} className="font-[family-name:var(--font-display)] text-xl font-semibold text-midnight">
          {a.question}
        </p>
      </div>
      {a.composite ? (
        <>
          <p className="mt-2 text-sm text-muted">{a.answer}</p>
          <DirectUnits units={a.units} id={`${base}-q`} />
          <details className="mt-4">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              All details · {a.what_changed.length + a.why_it_matters.length + a.recommended_actions.length + a.unknowns.length} statements
            </summary>
            <ClaimList title="What changed" claims={a.what_changed} id={`${base}-wc`} />
            <ClaimList title="Why it matters" claims={a.why_it_matters} id={`${base}-why`} />
            <RecommendationList claims={a.recommended_actions} id={`${base}-allrec`} />
            <ClaimList title="What ROOK cannot establish" claims={a.unknowns} id={`${base}-unk`} />
          </details>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-start gap-2">
            {a.claim_type ? <ClaimBadge type={a.claim_type} className="mt-0.5" /> : null}
            <p className="text-[15px] leading-relaxed text-ink">{a.answer}</p>
          </div>
          {a.confidence ? (
            <p className="mt-1 pl-1">
              <ConfidenceLabel value={a.confidence} />
            </p>
          ) : null}
        </>
      )}

      {!a.composite ? <ClaimList title="What changed" claims={a.what_changed} id={`${base}-wc`} /> : null}
      {!a.composite ? <ClaimList title="Why it matters" claims={a.why_it_matters} id={`${base}-why`} /> : null}
      <ClaimList title="Key points" claims={keyPoints.slice(0, 8)} id={`${base}-kp`} />

      {!a.composite ? <RecommendationList claims={a.recommended_actions} id={`${base}-rec`} /> : null}

      {a.sources.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Sources · {a.sources.length}
          </summary>
          <ul className="mt-2 space-y-2.5 border-l-2 border-gold/60 pl-3">
            {a.sources.map((s) => (
              <SourceLine key={s.signal_id} e={s} />
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
