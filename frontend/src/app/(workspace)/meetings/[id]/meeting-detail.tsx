"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { RecommendationClaim } from "@/components/actions";
import { CommitmentCard, DecisionCard, RiskCard } from "@/components/cards";
import { EvidenceList, SourceLine } from "@/components/evidence";
import { Empty, StateGate } from "@/components/states";
import { ClaimBadge } from "@/components/trust";
import { PageHeader, Section, primaryButtonClass } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import type { MeetingIntel, MeetingPrep } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/** Meeting detail (UX §6): preparation first; for past meetings, the extracted outcome. */
export function MeetingDetail({ id }: { id: number }) {
  const state = useApi(() => Promise.all([api.meetingPrep(id), api.meetingIntel(id)]), [id]);
  return (
    <StateGate state={state} what="this meeting" stage="Preparing">
      {([prep, intel]) => <Detail prep={prep} intel={intel} onChange={state.reload} />}
    </StateGate>
  );
}

function Detail({ prep, intel, onChange }: { prep: MeetingPrep; intel: MeetingIntel; onChange: () => void }) {
  const m = prep.meeting;
  const past = new Date(m.ends_at) < new Date();
  return (
    <>
      <PageHeader
        title={m.title}
        subtitle={`${formatDateTime(m.starts_at)} – ${formatTime(m.ends_at)}${m.project ? ` · ${m.project}` : ""}`}
      />
      {prep.prep_reasons.length && !past ? (
        <p className="mb-6 rounded-md border border-line bg-surface px-4 py-3 text-sm">
          <span className="font-medium">Preparation suggested:</span> {prep.prep_reasons.join("; ")}.
        </p>
      ) : null}

      <Section title="Purpose" id="md-purpose">
        <p className="text-sm">{m.purpose || <span className="text-muted">No purpose was given in the invitation.</span>}</p>
      </Section>

      <Section title="Participants" id="md-people" count={prep.participants.length}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {prep.participants.map((p) => (
            <li key={p.email} className="rounded-md border border-line bg-surface px-2 py-1">
              {p.name}{p.title ? <span className="text-muted"> · {p.title}</span> : null}
            </li>
          ))}
        </ul>
      </Section>

      {!past ? (
        <Section title="Suggested questions" id="md-questions" count={prep.suggested_questions.length}>
          {prep.suggested_questions.length ? (
            <ul className="space-y-2">{prep.suggested_questions.map((q, i) => <RecommendationClaim key={i} claim={q} />)}</ul>
          ) : (
            <Empty title="No suggested questions.">There are no open risks, pending decisions or due actions linked to this meeting.</Empty>
          )}
        </Section>
      ) : null}

      <Section title="Related risks" id="md-risks" count={prep.risks.length}>
        {prep.risks.length ? <ul className="space-y-3">{prep.risks.map((r) => <RiskCard key={r.id} r={r} />)}</ul> : <Empty title="No open risks linked to this meeting." />}
      </Section>

      <Section title="Related decisions" id="md-decisions" count={prep.decisions.length}>
        {prep.decisions.length ? <ul className="space-y-3">{prep.decisions.map((d) => <DecisionCard key={d.id} d={d} />)}</ul> : <Empty title="No decisions linked to this meeting's project yet." />}
      </Section>

      <Section title="Open actions" id="md-actions" count={prep.open_commitments.length}>
        {prep.open_commitments.length ? <ul className="space-y-3">{prep.open_commitments.map((c) => <CommitmentCard key={c.id} c={c} showAction />)}</ul> : <Empty title="No open actions." />}
      </Section>

      <Section title="Previous context" id="md-previous" count={prep.previous_meetings.length}>
        {prep.previous_meetings.length ? (
          <ul className="space-y-1 text-sm">
            {prep.previous_meetings.map((p) => (
              <li key={p.id}>
                <Link className="hover:underline" href={`/meetings/${p.id}`}>{p.title}</Link> <span className="text-muted">· {formatDateTime(p.starts_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No earlier meetings on this topic." />
        )}
      </Section>

      <Outcome intel={intel} past={past} meetingId={m.id} onChange={onChange} />

      <Section title="Sources" id="md-sources" count={prep.related_signals.length}>
        {prep.related_signals.length ? (
          <ul className="space-y-2">{prep.related_signals.map((s) => <SourceLine key={s.signal_id} e={s} />)}</ul>
        ) : (
          <Empty title="No related sources you can access." />
        )}
      </Section>
    </>
  );
}

function Outcome({ intel, past, meetingId, onChange }: { intel: MeetingIntel; past: boolean; meetingId: number; onChange: () => void }) {
  if (!past && !intel.has_transcript) return null;
  return (
    <Section title="Meeting outcome" id="md-outcome">
      {intel.has_transcript ? (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Extracted decisions</h3>
            {intel.decisions.length ? <ul className="space-y-3">{intel.decisions.map((d) => <DecisionCard key={d.id} d={d} />)}</ul> : <Empty title="No explicit decisions were made." />}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Extracted commitments</h3>
            {intel.commitments.length ? <ul className="space-y-3">{intel.commitments.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul> : <Empty title="No commitments were made." />}
          </div>
          {intel.open_questions.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Open questions</h3>
              <ul className="space-y-2">
                {intel.open_questions.map((q, i) => (
                  <li key={i} className="rounded-md border border-line bg-surface p-3 text-sm">
                    <div className="flex items-start gap-2"><ClaimBadge type={q.claim_type} /><span>{q.text}</span></div>
                    <div className="mt-1"><EvidenceList evidence={q.evidence} /></div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {intel.inform.length ? (
            <p className="text-sm"><span className="font-medium">Consider informing:</span> {intel.inform.map((p) => p.name).join(", ")} <span className="text-muted">(owners of commitments who weren&apos;t present)</span></p>
          ) : null}
        </div>
      ) : (
        <Empty title="No transcript has been captured for this meeting.">Add one below so ROOK can extract decisions and commitments.</Empty>
      )}
      {past ? <TranscriptUpload meetingId={meetingId} onDone={onChange} /> : null}
    </Section>
  );
}

function TranscriptUpload({ meetingId, onDone }: { meetingId: number; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const id = useId();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.uploadTranscript(meetingId, text);
      setText("");
      setMsg("Transcript analyzed. The outcome above is updated.");
      onDone();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "ROOK couldn't analyze the transcript.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-accent">Add transcript or notes</summary>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <label htmlFor={id} className="block text-xs text-muted">
          One line per speaker turn, e.g. “Priya Shah: We decided to …”. Visible only to this meeting&apos;s attendees.
        </label>
        <textarea id={id} rows={6} required minLength={10} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border border-line bg-surface p-2 text-sm" />
        <button type="submit" disabled={busy || text.trim().length < 10} className={primaryButtonClass}>{busy ? "Analyzing…" : "Analyze transcript"}</button>
        {msg ? <p role="status" className="text-sm text-muted">{msg}</p> : null}
      </form>
    </details>
  );
}
