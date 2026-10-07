"use client";

import { SourceIcon } from "@/components/evidence";
import { Icon } from "@/components/icons";
import { StateGate } from "@/components/states";
import { ClaimBadge } from "@/components/trust";
import { Field, PageHeader } from "@/components/ui";
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
          <PageHeader module="sources" title={s.title} subtitle="Original source" />
          <dl className="mb-10 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-1 shadow-[var(--shadow-card)]">
            <Field label="Source type">
              <span className="inline-flex items-center gap-2">
                <SourceIcon e={s} size={24} />
                {KIND[s.kind] ?? s.kind} · {s.channel}
              </span>
            </Field>
            <Field label="Author">{s.author || "System"}</Field>
            <Field label="Timestamp">{formatDateTime(s.occurred_at)}</Field>
            <Field label="Visibility">{s.visibility === "restricted" ? <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={14} accent />{`Restricted to ${s.participants.length} participant${s.participants.length === 1 ? "" : "s"}`}</span> : "Visible across your organisation"}</Field>
            <Field label="Original">
              {s.url ? <a className="inline-flex items-center gap-1.5 font-medium text-midnight underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer noopener"><Icon name="external" size={15} accent />Open in {s.channel}</a> : <span className="text-muted">No link available for this source</span>}
            </Field>
          </dl>
          <section aria-labelledby="ev-content">
            <div className="mb-2 flex items-center gap-2">
              <h2 id="ev-content" className="gold-rule text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Content</h2>
              <ClaimBadge type="FACT" />
              <span className="text-xs text-muted">Shown exactly as captured; ROOK has not changed it.</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-gold bg-surface p-4 font-[inherit] text-sm leading-relaxed shadow-[var(--shadow-card)]">{s.body}</pre>
          </section>
        </>
      )}
    </StateGate>
  );
}
