"use client";

import Link from "next/link";
import { useState } from "react";

import { RecommendationBlock } from "@/components/actions";
import { AnswerView, AskForm } from "@/components/ask";
import { CommitmentCard, DecisionCard, LEVEL_ACCENT, RiskCard } from "@/components/cards";
import { EvidenceList, SourceIcon } from "@/components/evidence";
import { RookButton, RookCard, RookIcon, RookInsightCard, RookMeta, RookMetricCard, RookPageHeader, RookSection } from "@/components/rook";
import { Empty, StateGate } from "@/components/states";
import { ClaimBadge, ConfidenceLabel, LevelPill, StatusText } from "@/components/trust";
import { api } from "@/lib/api";
import { formatTime, pluralize } from "@/lib/format";
import type { AskAnswer, AttentionItem, Brief } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const ATTENTION_HREF: Record<AttentionItem["type"], string> = { risk: "/risks", decision: "/decisions", commitment: "/commitments" };

/** Executive Home (UX §4, MVP P0): what needs attention first, then today, decisions, commitments, risks, changes. */
export default function HomePage() {
  const brief = useApi(() => api.brief());
  const [answer, setAnswer] = useState<AskAnswer | null>(null);

  return (
    <StateGate state={brief} what="your brief" stage="Preparing">
      {(b) => (
        <>
          <BriefHeader b={b} refreshing={brief.loading} onRefresh={brief.reload} />
          <Metrics b={b} />
          <div className="mb-10">
            <AskForm onAnswer={setAnswer} compact />
            <div aria-live="polite">{answer ? <div className="mt-4"><AnswerView a={answer} /></div> : null}</div>
          </div>

          <div className="grid gap-x-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Attention b={b} />
            <div>
              <Today b={b} />
              <RookSection title="Decisions pending" id="h-decisions" count={b.decisions_pending.length} more={{ href: "/decisions", label: "Register" }} icon="document">
                {b.decisions_pending.length ? (
                  <ul className="space-y-3">{b.decisions_pending.map((d) => <DecisionCard key={d.id} d={d} />)}</ul>
                ) : (
                  <Empty title="No decisions are waiting.">ROOK adds pending decisions when someone raises one in your connected sources.</Empty>
                )}
              </RookSection>
            </div>
          </div>

          <div className="grid gap-x-8 lg:grid-cols-2">
            <RookSection title="Your commitments" id="h-mine" count={b.my_commitments.length} more={{ href: "/commitments?tab=mine", label: "All" }} icon="checkSquare">
              {b.my_commitments.length ? (
                <ul className="space-y-3">{b.my_commitments.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul>
              ) : (
                <Empty title="You have no open commitments.">When you commit to something in a meeting or message, ROOK tracks it here.</Empty>
              )}
              {b.counts.proposed ? (
                <p className="mt-3 text-[13px] text-muted">
                  {pluralize(b.counts.proposed, "suggested action")} ROOK inferred need an owner.{" "}
                  <Link className="font-semibold text-midnight underline underline-offset-2" href="/commitments?tab=proposed">Review</Link>
                </p>
              ) : null}
            </RookSection>
            <RookSection title="Waiting for" id="h-waiting" count={b.waiting_for.length} more={{ href: "/commitments?tab=waiting", label: "All" }} icon="teams">
              {b.waiting_for.length ? (
                <ul className="space-y-3">{b.waiting_for.map((c) => <CommitmentCard key={c.id} c={c} showAction />)}</ul>
              ) : (
                <Empty title="You aren't waiting on anyone.">Commitments others make to you will appear here.</Empty>
              )}
            </RookSection>
          </div>

          <RookSection title="At risk" id="h-risks" count={b.risks.length} more={{ href: "/risks", label: "Risk radar" }} icon="risk">
            {b.risks.length ? (
              <ul className="grid gap-3 lg:grid-cols-2">
                {b.risks.map((r) => (
                  <RiskCard key={r.id} r={r} withAction={false} />
                ))}
              </ul>
            ) : (
              <Empty title="No open risks.">ROOK raises a risk only when evidence supports it, and explains why.</Empty>
            )}
          </RookSection>
          <Changes b={b} />
        </>
      )}
    </StateGate>
  );
}

function BriefHeader({ b, refreshing, onRefresh }: { b: Brief; refreshing: boolean; onRefresh: () => void }) {
  return (
    <RookPageHeader
      size="hero"
      eyebrow="Executive brief"
      title={b.greeting}
      tagline={b.date}
      meta={
        b.headline[0] ? (
          <p className="flex items-center gap-2.5 text-[16px] font-medium text-on-dark">
            <span aria-hidden className="h-2 w-2 bg-gold" />
            {b.headline[0]}
          </p>
        ) : null
      }
      actions={
        <div className="flex flex-col items-end gap-2 text-[12px] text-on-dark-muted">
          <RookButton variant="onDark" icon="refresh" onClick={onRefresh} disabled={refreshing}>
            Refresh
          </RookButton>
          <span role="status">{refreshing ? "Refreshing…" : `Prepared ${formatTime(b.generated_at)}`}</span>
        </div>
      }
    />
  );
}

function Metrics({ b }: { b: Brief }) {
  return (
    <section aria-labelledby="h-glance" className="mb-8">
      <h2 id="h-glance" className="sr-only">At a glance</h2>
      <div className="flex flex-wrap gap-3 [&>*]:min-w-[9.5rem] [&>*]:flex-1 [&>*]:basis-[9.5rem]">
        <RookMetricCard value={b.counts.attention} label="Need your attention" href="#h-attention" icon="target" />
        <RookMetricCard value={b.counts.meetings_today} label="Meetings today" href="#h-today" icon="calendar" />
        <RookMetricCard value={b.counts.decisions_pending} label="Decisions pending" href="#h-decisions" icon="document" />
        <RookMetricCard value={b.counts.waiting_for} label="Waiting for" href="#h-waiting" icon="teams" />
        <RookMetricCard value={b.counts.risks} label="Open risks" href="#h-risks" icon="risk" />
      </div>
    </section>
  );
}

/** Explanations longer than this are clamped on the card and shown in full under "Why ROOK believes this". */
const SHORT_WHY = 150;

function Attention({ b }: { b: Brief }) {
  return (
    <RookSection title="Needs your attention" id="h-attention" count={b.attention.length} icon="target">
      {b.attention.length ? (
        <ul className="space-y-3">
          {b.attention.map((a, i) => {
            const long = a.why.length > SHORT_WHY;
            return (
              <RookInsightCard
                key={`${a.type}-${a.id}`}
                emphasis={i === 0 ? "featured" : "standard"}
                accent={a.type === "risk" ? LEVEL_ACCENT[a.level] : "gold"}
                label={<ClaimBadge type={a.claim_type} />}
                eyebrow={a.label}
                title={a.title}
                href={`${ATTENTION_HREF[a.type]}/${a.id}`}
                signals={
                  <>
                    {a.type === "risk" ? <LevelPill level={a.level} /> : null}
                    <ConfidenceLabel value={a.confidence} />
                  </>
                }
                summary={a.why}
                clampSummary={long}
                why={long ? a.why : undefined}
                evidence={<EvidenceList evidence={a.evidence} />}
                action={a.recommended_action ? <RecommendationBlock bare rec={a.recommended_action} riskId={a.type === "risk" ? a.id : undefined} /> : undefined}
              />
            );
          })}
        </ul>
      ) : (
        <Empty title="Nothing needs your attention right now.">ROOK will surface decisions, overdue follow-ups and risks here as they emerge.</Empty>
      )}
    </RookSection>
  );
}

function Today({ b }: { b: Brief }) {
  return (
    <RookSection title="Today" id="h-today" count={b.today.length} more={{ href: "/meetings", label: "Meetings" }} icon="calendar">
      {b.today.length ? (
        <RookCard level={2} flush>
          <ul className="divide-y divide-line">
            {b.today.map((m) => (
              <li key={m.id} className={`relative px-4 py-3.5 ${m.past ? "" : "before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:bg-gold"}`}>
                <p className="text-[12px] font-semibold tabular-nums text-ink-soft">
                  {formatTime(m.starts_at)} – {formatTime(m.ends_at)}
                </p>
                <Link href={`/meetings/${m.id}`} className="mt-0.5 block font-semibold text-midnight underline-offset-2 decoration-gold hover:underline">
                  {m.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusText status={m.past ? "ended" : "upcoming"} />
                  {m.prep_required && !m.past ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                      <RookIcon name="insight" size={14} className="text-gold-deep" />
                      Preparation suggested
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </RookCard>
      ) : (
        <Empty title="No meetings today.">Meetings appear here once your calendar is connected in Sources.</Empty>
      )}
    </RookSection>
  );
}

function Changes({ b }: { b: Brief }) {
  return (
    <RookSection title="Recent changes" id="h-changes" count={b.changes.length} icon="status">
      {b.changes.length ? (
        <RookCard level={2} flush>
          <ul className="divide-y divide-line">
            {b.changes.map((c) => (
              <li key={c.signal_id} className="flex gap-3.5 px-4 py-3.5">
                <SourceIcon e={c} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ClaimBadge type={c.claim_type} />
                    <Link href={`/evidence/${c.signal_id}`} className="font-semibold text-midnight underline-offset-2 decoration-gold hover:underline">
                      {c.summary}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span>{c.channel}</span>
                    <RookMeta icon="person">{c.author}</RookMeta>
                    <RookMeta icon="clock">{formatTime(c.occurred_at)}</RookMeta>
                    {c.derived.length ? <RookMeta icon="related">ROOK derived: {c.derived.join(", ")}</RookMeta> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </RookCard>
      ) : (
        <Empty title="No meaningful changes in the last 36 hours." />
      )}
    </RookSection>
  );
}
