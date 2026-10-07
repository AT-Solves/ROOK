"use client";

import Link from "next/link";

import { Empty, StateGate } from "@/components/states";
import { PageHeader, Section } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatTime, isToday } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { useApi } from "@/lib/useApi";

function MeetingRow({ m }: { m: Meeting }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
      <span className="w-44 shrink-0 text-sm tabular-nums text-muted">
        {isToday(m.starts_at) ? `Today ${formatTime(m.starts_at)}` : formatDateTime(m.starts_at)}
      </span>
      <Link href={`/meetings/${m.id}`} className="font-medium hover:underline">{m.title}</Link>
      {m.project ? <span className="text-xs text-muted">{m.project}</span> : null}
      {!m.past && m.prep_reasons?.length ? <span className="text-xs text-muted">Preparation suggested: {m.prep_reasons.join("; ")}</span> : null}
      {m.past ? <span className="text-xs text-muted">{m.has_transcript ? "Outcome captured" : "No transcript"}</span> : null}
    </li>
  );
}

export default function MeetingsPage() {
  const state = useApi(() => api.meetings());
  return (
    <>
      <PageHeader title="Meetings" subtitle="Preparation before, outcomes after — from meetings you attend." />
      <StateGate
        state={state}
        what="your meetings"
        isEmpty={(d) => d.length === 0}
        empty={<Empty title="No meetings yet.">Connect your calendar in Sources and ROOK will prepare you for upcoming meetings.</Empty>}
      >
        {(all) => {
          const upcoming = all.filter((m) => !m.past);
          const past = all.filter((m) => m.past).reverse();
          return (
            <>
              <Section title="Upcoming" id="m-upcoming" count={upcoming.length}>
                {upcoming.length ? (
                  <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{upcoming.map((m) => <MeetingRow key={m.id} m={m} />)}</ul>
                ) : (
                  <Empty title="No upcoming meetings." />
                )}
              </Section>
              <Section title="Recent" id="m-past" count={past.length}>
                {past.length ? (
                  <ul className="divide-y divide-line rounded-lg border border-line bg-surface">{past.map((m) => <MeetingRow key={m.id} m={m} />)}</ul>
                ) : (
                  <Empty title="No past meetings in the synced window." />
                )}
              </Section>
            </>
          );
        }}
      </StateGate>
    </>
  );
}
