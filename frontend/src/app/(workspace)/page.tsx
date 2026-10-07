"use client";

import Link from "next/link";
import { useState } from "react";

import { RecommendationBlock } from "@/components/actions";
import { AnswerView, AskForm } from "@/components/ask";
import { CommitmentCard, DecisionCard, RiskCard } from "@/components/cards";
import { InsightCard } from "@/components/insight";
import { Empty, StateGate } from "@/components/states";
import { LevelPill } from "@/components/trust";
import { Section, buttonClass } from "@/components/ui";
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
          <div className="mb-8">
            <AskForm onAnswer={setAnswer} compact />
            <div aria-live="polite">{answer ? <div className="mt-3"><AnswerView a={answer} /></div> : null}</div>
          </div>
          <Attention b={b} />
          <Today b={b} />
          <Section title="Decisions pending" id="h-decisions" count={b.decisions_pending.length} more={{ href: "/decisions", label: "Decision register" }}>
            {b.decisions_pending.length ? (
              <ul className="space-y-3">{b.decisions_pending.map((d) => <DecisionCard key={d.id} d={d} />)}</ul>
            ) : (
              <Empty title="No decisions are waiting.">ROOK adds pending decisions when someone raises one in your connected sources.</Empty>
            )}
          </Section>
          <Section title="Your commitments" id="h-mine" count={b.my_commitments.length} more={{ href: "/commitments", label: "All commitments" }}>
            {b.my_commitments.length ? (
              <ul className="space-y-3">{b.my_commitments.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul>
            ) : (
              <Empty title="You have no open commitments.">When you commit to something in a meeting or message, ROOK tracks it here.</Empty>
            )}
            {b.counts.proposed ? (
              <p className="mt-2 text-sm text-muted">
                {pluralize(b.counts.proposed, "suggested action")} ROOK inferred need an owner.{" "}
                <Link className="text-accent underline" href="/commitments?tab=proposed">Review</Link>
              </p>
            ) : null}
          </Section>
          <Section title="Waiting for" id="h-waiting" count={b.waiting_for.length}>
            {b.waiting_for.length ? (
              <ul className="space-y-3">{b.waiting_for.map((c) => <CommitmentCard key={c.id} c={c} showAction />)}</ul>
            ) : (
              <Empty title="You aren't waiting on anyone.">Commitments others make to you will appear here.</Empty>
            )}
          </Section>
          <Section title="At risk" id="h-risks" count={b.risks.length} more={{ href: "/risks", label: "Risk radar" }}>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.greeting}</h1>
          <p className="text-sm text-muted">{b.date}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span role="status">{refreshing ? "Refreshing…" : `Brief prepared ${formatTime(b.generated_at)}`}</span>
          <button type="button" className={buttonClass} onClick={onRefresh} disabled={refreshing}>Refresh</button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Needs you", b.counts.attention, "#h-attention"],
          ["Meetings today", b.counts.meetings_today, "#h-today"],
          ["Decisions pending", b.counts.decisions_pending, "#h-decisions"],
          ["Waiting for", b.counts.waiting_for, "#h-waiting"],
          ["Open risks", b.counts.risks, "#h-risks"],
        ].map(([label, n, href]) => (
          <div key={label as string} className="rounded-md border border-line bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-lg font-semibold"><a href={href as string} className="hover:underline">{n}</a></dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function Attention({ b }: { b: Brief }) {
  return (
    <Section title="Needs your attention" id="h-attention" count={b.attention.length}>
      {b.attention.length ? (
        <ul className="space-y-3">
          {b.attention.map((a) => (
            <InsightCard
              key={`${a.type}-${a.id}`}
              title={a.title}
              href={`${ATTENTION_HREF[a.type]}/${a.id}`}
              claimType={a.claim_type}
              confidence={a.confidence}
              meta={<><span className="font-medium">{a.label}</span>{a.type === "risk" ? <LevelPill level={a.level} /> : null}</>}
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
    <Section title="Today" id="h-today" count={b.today.length} more={{ href: "/meetings", label: "All meetings" }}>
      {b.today.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {b.today.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3`}>
              <span className="w-28 shrink-0 text-sm tabular-nums text-muted">{formatTime(m.starts_at)}–{formatTime(m.ends_at)}</span>
              <Link href={`/meetings/${m.id}`} className="font-medium hover:underline">{m.title}</Link>
              {m.past ? <span className="text-xs text-muted">Ended</span> : null}
              {m.prep_required && !m.past ? (
                <span className="text-xs text-muted">Preparation suggested: {m.prep_reasons?.join("; ")}</span>
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
    <Section title="Recent changes" id="h-changes" count={b.changes.length}>
      {b.changes.length ? (
        <ul className="space-y-3">
          {b.changes.map((c) => (
            <InsightCard
              key={c.signal_id}
              title={c.summary}
              claimType={c.claim_type}
              meta={<><span>{c.channel}</span><span>{c.author}</span><span>{formatTime(c.occurred_at)}</span>{c.derived.length ? <span>ROOK derived: {c.derived.join(", ")}</span> : null}</>}
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
