"use client";

import Link from "next/link";

import { RookCard, RookIcon, RookMeta, RookPageHeader, RookSection } from "@/components/rook";
import { Empty, StateGate } from "@/components/states";
import { StatusText } from "@/components/trust";
import { api } from "@/lib/api";
import { formatDateTime, formatTime, isToday } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { useApi } from "@/lib/useApi";

function MeetingRow({ m }: { m: Meeting }) {
  return (
    <li className={`relative grid gap-x-6 gap-y-1 px-5 py-4 sm:grid-cols-[11rem_1fr] ${!m.past && m.prep_reasons?.length ? "before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:bg-gold" : ""}`}>
      <span className="text-[13px] font-semibold tabular-nums text-ink-soft">
        {isToday(m.starts_at) ? `Today ${formatTime(m.starts_at)}` : formatDateTime(m.starts_at)}
      </span>
      <div className="min-w-0">
        <Link href={`/meetings/${m.id}`} className="font-semibold text-midnight underline-offset-2 decoration-gold hover:underline">{m.title}</Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <StatusText status={m.past ? "ended" : "upcoming"} />
          {m.project ? <RookMeta icon="briefcase">{m.project}</RookMeta> : null}
          {!m.past && m.prep_reasons?.length ? (
            <span className="inline-flex items-center gap-1.5">
              <RookIcon name="insight" size={14} className="text-gold-deep" />
              Preparation suggested: {m.prep_reasons.join("; ")}
            </span>
          ) : null}
          {m.past ? <span>{m.has_transcript ? "Outcome captured" : "No transcript"}</span> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Why there are no meetings, from the Microsoft 365 connection's real state: not connected, connected but never
 * synchronized, or synchronized with nothing in the calendar period ROOK reads.
 */
function NoMeetings() {
  const ctx = useApi(() => api.context());
  if (!ctx.data) return <Empty title="No meetings yet." />;
  const ms = ctx.data.sources.find((s) => s.kind === "microsoft365");
  if (ms?.state !== "connected") {
    return <Empty title="No meetings yet.">Connect your calendar in Context and ROOK will prepare you for upcoming meetings.</Empty>;
  }
  if (!ms.connection?.last_successful_sync) {
    return (
      <Empty title="Your Microsoft 365 calendar is connected but hasn't been synchronized yet.">
        ROOK will prepare your meetings after the first sync.
      </Empty>
    );
  }
  return <Empty title="No meetings found for the available calendar period." />;
}

export default function MeetingsPage() {
  const state = useApi(() => api.meetings());
  return (
    <>
      <RookPageHeader
        eyebrow="Preparation & outcomes"
        title="Meetings"
        tagline="Prepare for the conversations that matter."
        meta={<span className="text-on-dark-muted">Preparation before, outcomes after — from meetings you attend.</span>}
      />
      <StateGate
        state={state}
        what="your meetings"
        isEmpty={(d) => d.length === 0}
        empty={<NoMeetings />}
      >
        {(all) => {
          const upcoming = all.filter((m) => !m.past);
          const past = all.filter((m) => m.past).reverse();
          return (
            <>
              <RookSection title="Upcoming" id="m-upcoming" count={upcoming.length} icon="calendar">
                {upcoming.length ? (
                  <RookCard level={2} flush><ul className="divide-y divide-line">{upcoming.map((m) => <MeetingRow key={m.id} m={m} />)}</ul></RookCard>
                ) : (
                  <Empty title="No upcoming meetings." />
                )}
              </RookSection>
              <RookSection title="Recent" id="m-past" count={past.length} icon="clock">
                {past.length ? (
                  <RookCard level={2} flush><ul className="divide-y divide-line">{past.map((m) => <MeetingRow key={m.id} m={m} />)}</ul></RookCard>
                ) : (
                  <Empty title="No past meetings in the synced window." />
                )}
              </RookSection>
            </>
          );
        }}
      </StateGate>
    </>
  );
}
