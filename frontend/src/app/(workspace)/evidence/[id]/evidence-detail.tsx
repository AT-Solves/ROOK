"use client";

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
          <PageHeader title={s.title} subtitle="Original source" />
          <dl className="mb-6 rounded-lg border border-line bg-surface px-4 py-2">
            <Field label="Source type">{KIND[s.kind] ?? s.kind} · {s.channel}</Field>
            <Field label="Author">{s.author || "System"}</Field>
            <Field label="Timestamp">{formatDateTime(s.occurred_at)}</Field>
            <Field label="Visibility">{s.visibility === "restricted" ? `Restricted to ${s.participants.length} participant${s.participants.length === 1 ? "" : "s"}` : "Visible across your organisation"}</Field>
            <Field label="Original">
              {s.url ? <a className="text-accent underline" href={s.url} target="_blank" rel="noreferrer noopener">Open in {s.channel}</a> : <span className="text-muted">No link available for this source</span>}
            </Field>
          </dl>
          <section aria-labelledby="ev-content">
            <div className="mb-2 flex items-center gap-2">
              <h2 id="ev-content" className="text-sm font-semibold uppercase tracking-wide text-muted">Content</h2>
              <ClaimBadge type="FACT" />
              <span className="text-xs text-muted">Shown exactly as captured; ROOK has not changed it.</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 font-[inherit] text-sm leading-relaxed">{s.body}</pre>
          </section>
        </>
      )}
    </StateGate>
  );
}
