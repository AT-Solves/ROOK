"use client";

import Link from "next/link";

import { RookButtonLink, RookSection } from "@/components/rook";
import { api } from "@/lib/api";
import { formatTime, pluralize } from "@/lib/format";
import { upcomingToday } from "@/lib/situations";
import type { Meeting } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/** One upcoming meeting as a preparation opportunity. Preparation loads after the brief (progressive). */
export function RookMeetingPreparation({ m }: { m: Meeting }) {
  const prep = useApi(() => api.meetingPrep(m.id), [m.id]);
  const p = prep.data;
  const facts = p
    ? [
        pluralize(p.participants.length, "participant"),
        p.decisions.length ? pluralize(p.decisions.length, "decision") : null,
        p.risks.length ? pluralize(p.risks.length, "risk") : null,
        p.open_commitments.length ? pluralize(p.open_commitments.length, "open commitment") : null,
      ].filter(Boolean)
    : [pluralize(m.attendees.length, "participant")];
  return (
    <li className="grid grid-cols-[4.25rem_1fr] gap-x-3 py-3.5 sm:grid-cols-[4.25rem_1fr_auto]">
      <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-midnight">{formatTime(m.starts_at)}</span>
      <div className="min-w-0">
        <Link href={`/meetings/${m.id}`} className="font-semibold text-midnight underline-offset-2 decoration-gold hover:underline">
          {m.title}
        </Link>
        <p className="mt-0.5 text-[12px] text-muted">{facts.join(" · ")}</p>
        {p?.suggested_questions.length ? (
          <p className="mt-1.5 text-[13px] text-ink-soft">
            <span className="font-semibold text-midnight">ROOK prepared </span>
            {pluralize(p.suggested_questions.length, "question")}
            {p.open_commitments.length ? `, ${pluralize(p.open_commitments.length, "open commitment")} to check` : ""}
          </p>
        ) : prep.loading ? (
          <p className="mt-2 text-[12px] text-muted" role="status">
            Preparing…
          </p>
        ) : null}
      </div>
      <div className="col-start-2 mt-2 sm:col-start-3 sm:mt-0">
        <RookButtonLink href={`/meetings/${m.id}`} variant="secondary" icon="calendar" className="px-3 py-1.5">
          Prepare
        </RookButtonLink>
      </div>
    </li>
  );
}

/** Today's moves: the remaining meetings, each with what ROOK prepared; earlier meetings collapse to one line. */
export function RookTodaysMoves({ today }: { today: Meeting[] }) {
  const { upcoming, earlier } = upcomingToday(today);
  return (
    <RookSection title="Today's moves" id="h-today" count={upcoming.length} icon="calendar" more={{ href: "/meetings", label: "Meetings" }}>
      <div className="rounded-[var(--radius-md)] border border-line bg-surface px-5 shadow-[var(--shadow-card)]">
        {upcoming.length ? (
          <ul className="divide-y divide-line">
            {upcoming.map((m) => (
              <RookMeetingPreparation key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-[14px] text-muted">No more meetings today.</p>
        )}
        {earlier.length ? (
          <p className="border-t border-line py-3 text-[12px] text-muted">
            <span className="font-semibold">Earlier today: </span>
            {earlier.map((m, i) => (
              <span key={m.id}>
                {i ? " · " : ""}
                <Link href={`/meetings/${m.id}`} className="underline-offset-2 hover:text-midnight hover:underline">
                  {m.title}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </RookSection>
  );
}
