"use client";

import Link from "next/link";
import { useState } from "react";

import { RecommendationBlock } from "@/components/actions";
import { AnswerView, AskForm } from "@/components/ask";
import { RookMark } from "@/components/brand";
import { CommitmentCard, DecisionCard, Meta, RiskCard } from "@/components/cards";
import { SourceIcon } from "@/components/evidence";
import { Icon } from "@/components/icons";
import { InsightCard } from "@/components/insight";
import { Empty, StateGate } from "@/components/states";
import { LevelPill, StatusText } from "@/components/trust";
import { Button, CounterTile, Section } from "@/components/ui";
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
          <div className="mb-10 rounded-[var(--radius-md)] border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
            <AskForm onAnswer={setAnswer} compact />
            <div aria-live="polite">{answer ? <div className="mt-3"><AnswerView a={answer} /></div> : null}</div>
          </div>
          <Attention b={b} />
          <Today b={b} />
          <Section title="Decisions pending" id="h-decisions" count={b.decisions_pending.length} more={{ href: "/decisions", label: "Decision register" }} icon="flag">
            {b.decisions_pending.length ? (
              <ul className="space-y-3">{b.decisions_pending.map((d) => <DecisionCard key={d.id} d={d} />)}</ul>
            ) : (
              <Empty title="No decisions are waiting.">ROOK adds pending decisions when someone raises one in your connected sources.</Empty>
            )}
          </Section>
          <Section title="Your commitments" id="h-mine" count={b.my_commitments.length} more={{ href: "/commitments", label: "All commitments" }} icon="checkCircle">
            {b.my_commitments.length ? (
              <ul className="space-y-3">{b.my_commitments.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul>
            ) : (
              <Empty title="You have no open commitments.">When you commit to something in a meeting or message, ROOK tracks it here.</Empty>
            )}
            {b.counts.proposed ? (
              <p className="mt-2 text-sm text-muted">
                {pluralize(b.counts.proposed, "suggested action")} ROOK inferred need an owner.{" "}
                <Link className="font-medium text-midnight underline underline-offset-2" href="/commitments?tab=proposed">Review</Link>
              </p>
            ) : null}
          </Section>
          <Section title="Waiting for" id="h-waiting" count={b.waiting_for.length} icon="teams">
            {b.waiting_for.length ? (
              <ul className="space-y-3">{b.waiting_for.map((c) => <CommitmentCard key={c.id} c={c} showAction />)}</ul>
            ) : (
              <Empty title="You aren't waiting on anyone.">Commitments others make to you will appear here.</Empty>
            )}
          </Section>
          <Section title="At risk" id="h-risks" count={b.risks.length} more={{ href: "/risks", label: "Risk radar" }} icon="risk">
            {b.risks.length ? (
              <ul className="space-y-3">{b.risks.map((r) => <RiskCard key={r.id} r={r} withAction={false} />)}</ul>
            ) : (
              <Empty title="No open risks.">ROOK raises a risk only when evidence supports it, and explains why.</Empty>
            )}
          </Section>
          <Changes b={b} />
        </>
      )}
    </StateGate>
  );
}

function BriefHeader({ b, refreshing, onRefresh }: { b: Brief; refreshing: boolean; onRefresh: () => void }) {
  return (
    <header className="mb-6">
      {/* Executive briefing hero: midnight board texture, rook watermark (brand), greeting first. */}
      <div className="surface-dark board-hero relative overflow-hidden rounded-[var(--radius-lg)] px-6 py-7 text-white md:px-8">
        <RookMark tone="outline" size={190} className="pointer-events-none absolute -bottom-6 right-4 opacity-70 md:right-10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-gold">Executive brief</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight md:text-[2.75rem]">{b.greeting}</h1>
            <p className="mt-1 text-sm text-slate-300">{b.date}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span role="status">{refreshing ? "Refreshing…" : `Brief prepared ${formatTime(b.generated_at)}`}</span>
            <Button variant="quiet" icon="refresh" onClick={onRefresh} disabled={refreshing} className="border border-white/20 bg-white/5 text-white hover:bg-white/10">
              Refresh
            </Button>
          </div>
        </div>
        {b.headline[0] ? <p className="relative mt-5 max-w-2xl text-[15px] text-slate-200">{b.headline[0]}</p> : null}
      </div>
      <h2 className="sr-only">At a glance</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <CounterTile value={b.counts.attention} label="Need your attention" href="#h-attention" icon="clock" tone="risk" />
        <CounterTile value={b.counts.meetings_today} label="Meetings today" href="#h-today" icon="calendar" tone="blue" />
        <CounterTile value={b.counts.decisions_pending} label="Decisions pending" href="#h-decisions" icon="document" tone="gold" />
        <CounterTile value={b.counts.waiting_for} label="Waiting for" href="#h-waiting" icon="teams" tone="purple" />
        <CounterTile value={b.counts.risks} label="Open risks" href="#h-risks" icon="risk" tone="risk" />
      </div>
    </header>
  );
}

function Attention({ b }: { b: Brief }) {
  return (
    <Section title="Needs your attention" id="h-attention" count={b.attention.length} icon="target">
      {b.attention.length ? (
        <ul className="space-y-3">
          {b.attention.map((a) => (
            <InsightCard
              key={`${a.type}-${a.id}`}
              title={a.title}
              href={`${ATTENTION_HREF[a.type]}/${a.id}`}
              claimType={a.claim_type}
              confidence={a.confidence}
              meta={<><span className="font-semibold text-ink-soft">{a.label}</span>{a.type === "risk" ? <LevelPill level={a.level} /> : null}</>}
              why={a.why}
              evidence={a.evidence}
            >
              <RecommendationBlock rec={a.recommended_action} riskId={a.type === "risk" ? a.id : undefined} />
            </InsightCard>
          ))}
        </ul>
      ) : (
        <Empty title="Nothing needs your attention right now.">ROOK will surface decisions, overdue follow-ups and risks here as they emerge.</Empty>
      )}
    </Section>
  );
}

function Today({ b }: { b: Brief }) {
  return (
    <Section title="Today" id="h-today" count={b.today.length} more={{ href: "/meetings", label: "All meetings" }} icon="calendar">
      {b.today.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]">
          {b.today.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
              <span className="w-44 shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-ink-soft">{formatTime(m.starts_at)} – {formatTime(m.ends_at)}</span>
              <Link href={`/meetings/${m.id}`} className="font-semibold text-midnight underline-offset-2 hover:underline">{m.title}</Link>
              <StatusText status={m.past ? "ended" : "upcoming"} />
              {m.prep_required && !m.past ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Icon name="insight" size={14} accent className="text-chess" />
                  Preparation suggested: {m.prep_reasons?.join("; ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No meetings today.">Meetings appear here once your calendar is connected in Sources.</Empty>
      )}
    </Section>
  );
}

function Changes({ b }: { b: Brief }) {
  return (
    <Section title="Recent changes" id="h-changes" count={b.changes.length} icon="status">
      {b.changes.length ? (
        <ul className="space-y-3">
          {b.changes.map((c) => (
            <InsightCard
              key={c.signal_id}
              title={c.summary}
              claimType={c.claim_type}
              meta={<><span className="inline-flex items-center gap-1.5"><SourceIcon e={c} size={20} />{c.channel}</span><Meta icon="person">{c.author}</Meta><Meta icon="clock">{formatTime(c.occurred_at)}</Meta>{c.derived.length ? <Meta icon="related">ROOK derived: {c.derived.join(", ")}</Meta> : null}</>}
              evidence={[c]}
            />
          ))}
        </ul>
      ) : (
        <Empty title="No meaningful changes in the last 36 hours." />
      )}
    </Section>
  );
}
