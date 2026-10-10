"use client";

import { SourceIcon } from "@/components/evidence";
import { RookCard, RookField as Field, RookIcon as Icon, RookPageHeader, RookSectionHeader } from "@/components/rook";
import { StateGate } from "@/components/states";
import { ClaimBadge } from "@/components/trust";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const KIND: Record<string, string> = {
  email: "Email",
  message: "Chat message",
  meeting_transcript: "Meeting transcript",
  task_update: "Work item update",
  document: "Document",
};

/** Source view (UX §11): type, author, timestamp, permitted content, open original. Raw source comes last. */
export function EvidenceDetail({ id }: { id: number }) {
  const state = useApi(() => api.signal(id), [id]);
  return (
    <StateGate state={state} what="this source">
      {(s) => (
        <>
          <RookPageHeader size="detail" eyebrow="Original source" title={s.title} tagline={`${s.channel} · ${s.author || "System"} · ${formatDateTime(s.occurred_at)}`} />
          <RookCard as="dl" level={1} flush className="mb-10 px-5 py-1 md:px-6">
            <Field label="Source type">
              <span className="inline-flex items-center gap-2">
                <SourceIcon e={s} size={24} />
                {KIND[s.kind] ?? s.kind} · {s.channel}
              </span>
            </Field>
            <Field label="Author">{s.author || "System"}</Field>
            <Field label="Timestamp">{formatDateTime(s.occurred_at)}</Field>
            <Field label="Visibility">{s.visibility === "restricted" ? <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={14} className="text-gold-deep" />{`Restricted to ${s.participants.length} participant${s.participants.length === 1 ? "" : "s"}`}</span> : "Visible across your organisation"}</Field>
            <Field label="Original">
              {s.url ? <a className="inline-flex items-center gap-1.5 font-semibold text-midnight underline decoration-gold underline-offset-2" href={s.url} target="_blank" rel="noreferrer noopener"><Icon name="external" size={15} className="text-gold-deep" />Open in {s.channel}</a> : <span className="text-muted">No link available for this source</span>}
            </Field>
          </RookCard>
          <section aria-labelledby="ev-content">
            <RookSectionHeader id="ev-content" title="Content" icon="document" />
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <ClaimBadge type="FACT" />
              <span className="text-[12px] text-muted">Shown exactly as captured; ROOK has not changed it.</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-line border-l-2 border-l-gold bg-surface p-5 font-[inherit] text-[14px] leading-relaxed text-ink-soft shadow-[var(--shadow-card)]">{s.body}</pre>
          </section>
        </>
      )}
    </StateGate>
  );
}
