"use client";

import { useId, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { AskAnswer, Claim, ClaimType } from "@/lib/types";

import { ActionControl, RecommendationClaim } from "./actions";
import { EvidenceList, SourceLine } from "./evidence";
import { RookAskBar, RookIcon, RookMark, type IconName } from "./rook";
import { ClaimBadge, ConfidenceLabel } from "./trust";

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
      <RookAskBar
        inputId={inputId}
        value={q}
        onChange={setQ}
        onSubmit={() => submit(q)}
        busy={busy}
        size={compact ? "standard" : "hero"}
      />
      {!compact ? (
        <div className="mt-4">
          <p className="rook-caps mb-2.5 text-muted">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {MVP_QUESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => submit(s)}
                className="rook-interactive inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:border-gold hover:text-midnight disabled:opacity-55"
              >
                <RookIcon name="arrowRight" size={13} className="text-gold-deep" />
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted">
          <RookMark tone="midnight" size={16} className="animate-pulse" />
          Analyzing your permitted sources…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 border-l-2 border-risk pl-3 text-sm text-[var(--risk-ink)]">
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
      <h3 id={id} className="rook-caps text-ink-soft">
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
      <h3 id={id} className="rook-caps text-ink-soft">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {claims.map((c, i) => (
          <li key={i} className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <ClaimBadge type={c.claim_type} />
            <p className="mt-1.5 text-[14px] leading-relaxed text-midnight">{c.text}</p>
            {c.meta ? <p className="text-[12px] text-muted">{c.meta}</p> : null}
            {c.detail ? <p className="mt-1 text-sm text-muted">{c.detail}</p> : null}
            {c.evidence.length ? (
              <div className="mt-2">
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
  FACT: { icon: "document", edge: "border-l-[var(--fact-mark)]" },
  INFERENCE: { icon: "insight", edge: "border-l-[var(--inf-mark)]" },
  RECOMMENDATION: { icon: "target", edge: "border-l-gold" },
  UNKNOWN: { icon: "search", edge: "border-l-[var(--unk-mark)] border-dashed" },
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
    <ol aria-labelledby={id} className="mt-5 space-y-3">
      {units.map((u, i) => (
        <li key={i} className={`rounded-[var(--radius-md)] border border-line border-l-2 bg-surface px-4 py-3.5 ${UNIT_STYLE[u.claim_type].edge}`} data-unit-type={u.claim_type}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <RookIcon name={UNIT_STYLE[u.claim_type].icon} size={16} className="text-midnight" />
            <span className="text-[13px] font-semibold text-midnight">{UNIT_HEADING[u.claim_type]}</span>
            <ClaimBadge type={u.claim_type} />
            {u.claim_type !== "UNKNOWN" ? <ConfidenceLabel value={u.confidence} /> : null}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{u.text}</p>
          {u.basis ? <p className="mt-1 text-[12px] text-muted">{u.basis}</p> : null}
          {u.evidence.length ? (
            <div className="mt-2">
              <EvidenceList evidence={u.evidence} label={u.claim_type === "RECOMMENDATION" ? "Based on" : "Source"} />
            </div>
          ) : null}
          {u.action ? (
            <div className="mt-3">
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
    <article aria-labelledby={`${base}-q`} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-insight)] md:p-6">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-midnight">
          <RookMark tone="gold" size={20} />
        </span>
        <p id={`${base}-q`} className="rook-display text-[1.6rem] text-midnight">
          {a.question}
        </p>
      </div>
      {a.composite ? (
        <>
          <p className="mt-4 text-[14px] text-muted">{a.answer}</p>
          <DirectUnits units={a.units} id={`${base}-q`} />
          <details className="mt-4">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-ink-soft hover:text-midnight">
              <RookIcon name="chevronRight" size={13} strokeWidth={2.2} className="rook-disclosure text-gold-deep" />
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
          <div className="mt-4">
            {a.claim_type ? <ClaimBadge type={a.claim_type} /> : null}
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{a.answer}</p>
          </div>
          {a.confidence ? (
            <p className="mt-1">
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
        <details className="mt-5 border-t border-line pt-4">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-ink-soft hover:text-midnight">
            <RookIcon name="chevronRight" size={13} strokeWidth={2.2} className="rook-disclosure text-gold-deep" />
            <RookIcon name="database" size={14} className="text-chess" />
            <span>Sources · {a.sources.length}</span>
          </summary>
          <ul className="mt-2.5 space-y-3 rounded-[var(--radius-sm)] bg-sunken px-3.5 py-3">
            {a.sources.map((s) => (
              <SourceLine key={s.signal_id} e={s} />
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
