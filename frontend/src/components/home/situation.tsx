"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ActionControl } from "@/components/actions";
import { AnswerView, MVP_QUESTIONS } from "@/components/ask";
import { EvidenceList } from "@/components/evidence";
import { RookButton, RookIcon, RookSection } from "@/components/rook";
import { ClaimBadge, ConfidenceLabel, LevelPill, StatusText } from "@/components/trust";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatTime, isToday } from "@/lib/format";
import { dependencySignals, firstSentence, type Situation } from "@/lib/situations";
import type { AskAnswer, Commitment, Decision, EvidenceRef, Risk } from "@/lib/types";
import { useApi } from "@/lib/useApi";

function when(iso: string | null) {
  if (!iso) return "";
  return isToday(iso) ? formatTime(iso) : formatDate(iso);
}

/** Merge records by id: the brief's records first, then permission-filtered related records from the detail view. */
function mergeById<T extends { id: number }>(...lists: (T[] | undefined)[]): T[] {
  const seen = new Map<number, T>();
  lists.flat().forEach((x) => x && !seen.has(x.id) && seen.set(x.id, x));
  return [...seen.values()];
}

/** One connected record, as a compact row. */
function Link_({ kind, href, children, status }: { kind: string; href: string; children: ReactNode; status?: ReactNode }) {
  return (
    <li className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
      <span className="flex items-center gap-1.5 font-semibold text-muted">
        <RookIcon name="arrowRight" size={12} className="text-gold-deep" />
        {kind}
      </span>
      <span className="min-w-0">
        <Link href={href} className="font-medium text-midnight underline-offset-2 decoration-gold hover:underline">
          {children}
        </Link>
        {status ? <span className="ml-2 inline-flex align-middle">{status}</span> : null}
      </span>
    </li>
  );
}

function Connections({ risk, decisions, commitments, signals, compact }: { risk: Risk | null; decisions: Decision[]; commitments: Commitment[]; signals: EvidenceRef[]; compact: boolean }) {
  const rows = [
    ...decisions.map((d) => (
      <Link_ key={`d${d.id}`} kind="Decision" href={`/decisions/${d.id}`} status={<StatusText status={d.status} />}>
        {d.code} · {d.statement}
      </Link_>
    )),
    ...commitments.map((c) => (
      <Link_ key={`c${c.id}`} kind="Commitment" href={`/commitments/${c.id}`} status={<StatusText status={c.status} />}>
        {c.mine ? "You" : c.owner}: {c.description}
      </Link_>
    )),
    ...(signals.length
      ? [
          <Link_ key="dep" kind="Dependency" href={`/evidence/${signals[signals.length - 1].signal_id}`}>
            {signals.map((s) => s.channel).filter((v, i, a) => a.indexOf(v) === i).join(" · ")} signal{signals.length === 1 ? "" : "s"}
          </Link_>,
        ]
      : []),
    ...(risk && !compact
      ? [
          <Link_ key="risk" kind="Risk" href={`/risks/${risk.id}`} status={<LevelPill level={risk.level} />}>
            {risk.title}
          </Link_>,
        ]
      : []),
  ];
  if (!rows.length) return null;
  return (
    <div>
      <p className="rook-caps mb-2.5 text-muted">Connected context</p>
      <ul className="divide-y divide-line">{rows}</ul>
    </div>
  );
}

/**
 * A situation: connected records shown once, with each line carrying its own claim type.
 * `primary` loads the lead risk's detail (permission-filtered related decisions/commitments) after first paint.
 */
export function RookSituationCard({ s, primary = false }: { s: Situation; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const leadRisk = s.lead.kind === "risk" ? s.lead.record : null;
  const detail = useApi(() => (leadRisk ? api.risk(leadRisk.id) : Promise.resolve(null)), [leadRisk?.id ?? 0]);
  const risk = detail.data ?? leadRisk;
  const decisions = mergeById(s.decisions, risk?.related_decisions);
  const commitments = mergeById(s.commitments, risk?.related_commitments);
  const signals = risk ? dependencySignals(risk.evidence) : [];
  // A situation cites each source once, however many of its records rely on it.
  const evidence: EvidenceRef[] = [
    ...new Map([...s.risks, ...s.decisions, ...s.commitments, ...decisions, ...commitments].flatMap((x) => x.evidence).map((e) => [e.signal_id, e] as const)).values(),
  ];
  const lead = s.attention[0];
  const claim = lead?.claim_type ?? s.lead.record.claim_type;
  const why = lead?.why ?? (leadRisk ? leadRisk.explanation : "");
  const facts = s.facts.slice(0, 2);
  const recAction = s.recommendation && "type" in s.recommendation.action ? s.recommendation.action : null;

  return (
    <article aria-labelledby={`sit-${s.key}`} className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-insight)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-gold">
      <div className="grid gap-x-8 gap-y-5 p-5 md:px-7 md:py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ClaimBadge type={claim} />
            {s.context ? <span className="rook-caps text-gold-deep">{s.context}</span> : null}
            {lead ? <span className="text-[12px] font-semibold text-muted">{lead.label}</span> : null}
          </div>
          <h3 id={`sit-${s.key}`} className={`rook-display mt-2.5 text-midnight ${primary ? "text-[1.7rem] md:text-[1.9rem]" : "text-[1.4rem]"}`}>
            <Link href={`/${s.lead.kind === "risk" ? "risks" : s.lead.kind === "decision" ? "decisions" : "commitments"}/${s.lead.record.id}`} className="underline-offset-4 decoration-gold decoration-[1.5px] hover:underline">
              {s.title}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {s.lead.kind === "risk" || lead?.type === "risk" ? <LevelPill level={s.level} /> : null}
            <ConfidenceLabel value={s.confidence} />
          </div>

          {facts.length ? (
            <ul className="mt-3.5 space-y-1.5">
              {facts.map((f) => (
                <li key={f.signal_id} className="flex items-start gap-2.5">
                  <ClaimBadge type={f.claim_type} className="mt-0.5" />
                  <p className="line-clamp-2 min-w-0 text-[14px] leading-snug text-ink-soft">
                    <Link href={`/evidence/${f.signal_id}`} className="text-midnight underline-offset-2 decoration-gold hover:underline">
                      {f.summary}
                    </Link>
                    <span className="ml-1.5 text-[12px] text-muted">
                      {f.channel} · {when(f.occurred_at)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          ) : why ? (
            <p className="mt-4 line-clamp-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{why}</p>
          ) : null}

          {s.recommendation ? (
            <div className="mt-4 border-l-2 border-gold pl-4">
              <ClaimBadge type="RECOMMENDATION" />
              <p className="mt-1.5 text-[15px] font-medium leading-snug text-midnight">{firstSentence(s.recommendation.text)}</p>
              {recAction ? (
                <div className="mt-3">
                  <ActionControl action={recAction} riskId={leadRisk?.id} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 rounded-[var(--radius-md)] bg-sunken px-4 py-4">
          <Connections risk={risk} decisions={decisions} commitments={commitments} signals={signals} compact={s.lead.kind === "risk"} />
          <div className="mt-4">
            <EvidenceList evidence={evidence} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-2.5 md:px-7">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`sit-${s.key}-more`}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] text-[13px] font-semibold text-midnight hover:text-gold-deep"
        >
          <RookIcon name={open ? "chevronDown" : "chevronRight"} size={14} strokeWidth={2.2} className="text-gold-deep" />
          {open ? "Hide situation" : "See situation"}
        </button>
        {primary ? <FullBriefing /> : null}
      </div>

      {open ? (
        <div id={`sit-${s.key}-more`} className="border-t border-line bg-board/50 px-5 py-5 md:px-7">
          <SituationDetail s={s} risk={risk} decisions={decisions} commitments={commitments} evidence={evidence} why={why} />
        </div>
      ) : null}
    </article>
  );
}

function SituationDetail({ s, risk, decisions, commitments, evidence, why }: { s: Situation; risk: Risk | null; decisions: Decision[]; commitments: Commitment[]; evidence: EvidenceRef[]; why: string }) {
  const people = [...new Set([...decisions.map((d) => d.owner), ...commitments.map((c) => (c.mine ? "" : c.owner))].filter(Boolean))];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {why ? (
          <div>
            <ClaimBadge type={s.attention[0]?.claim_type ?? s.lead.record.claim_type} />
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{why}</p>
            {risk?.basis ? <p className="mt-1 text-[12px] text-muted">{risk.basis}</p> : null}
          </div>
        ) : null}
        {s.recommendation ? (
          <div>
            <ClaimBadge type="RECOMMENDATION" />
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{s.recommendation.text}</p>
          </div>
        ) : null}
        {people.length ? (
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold text-muted">People involved: </span>
            {people.join(", ")}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">
        {risk ? (
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold text-muted">Risk record: </span>
            <Link href={`/risks/${risk.id}`} className="font-medium text-midnight underline-offset-2 decoration-gold hover:underline">
              {risk.title}
            </Link>
          </p>
        ) : null}
        <EvidenceList evidence={evidence} open label="All evidence" />
      </div>
    </div>
  );
}

/**
 * "See full briefing": runs the existing Ask ROOK question only when the user asks for it (D-1).
 * Ask writes an audit record, so Home never calls it on its own.
 */
export function FullBriefing() {
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.ask(MVP_QUESTIONS[0]));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ROOK couldn't prepare the briefing.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RookButton variant="quiet" icon="ask" onClick={run} disabled={busy} className="px-1.5">
        {busy ? "Preparing full briefing…" : answer ? "Refresh full briefing" : "See full briefing"}
      </RookButton>
      <div aria-live="polite" className="w-full empty:hidden">
        {error ? (
          <p role="alert" className="border-l-2 border-risk pl-3 text-sm text-[var(--risk-ink)]">
            {error}
          </p>
        ) : null}
        {answer ? (
          <div className="pb-2 pt-1">
            <AnswerView a={answer} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** The one situation that needs judgment — or a calm statement that none does. */
export function RookJudgmentCard({ s }: { s: Situation | null }) {
  return (
    <RookSection title="One thing needs your judgment" id="h-judgment" icon="target">
      {s ? (
        <RookSituationCard s={s} primary />
      ) : (
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-6 shadow-[var(--shadow-card)]">
          <p className="rook-display text-[1.5rem] text-midnight">ROOK sees no immediate situation requiring your judgment.</p>
          <p className="mt-1.5 text-[14px] text-muted">Today&apos;s moves and what ROOK is watching are below.</p>
        </div>
      )}
    </RookSection>
  );
}
