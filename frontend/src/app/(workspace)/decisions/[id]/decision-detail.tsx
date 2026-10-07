"use client";

import Link from "next/link";

import { RiskCard } from "@/components/cards";
import { EvidenceList } from "@/components/evidence";
import { Empty, StateGate } from "@/components/states";
import { ClaimBadge, ConfidenceLabel, StatusText } from "@/components/trust";
import { Field, PageHeader, Section } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** Decision detail (UX §7). */
export function DecisionDetail({ id }: { id: number }) {
  const state = useApi(() => api.decision(id), [id]);
  return (
    <StateGate state={state} what="this decision">
      {(d) => (
        <>
          <PageHeader title={d.statement} subtitle={<span className="font-mono">{d.code}</span>} />
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <ClaimBadge type={d.claim_type} />
            <ConfidenceLabel value={d.confidence} />
            <span className="text-xs text-muted">{d.basis}</span>
          </div>
          <dl className="mb-8 rounded-lg border border-line bg-surface px-4 py-2">
            <Field label="Status"><StatusText status={d.status} />{d.needs_me ? <span className="ml-2 text-xs">· waiting for you</span> : null}</Field>
            <Field label="Date">{formatDateTime(d.decided_at)}</Field>
            <Field label={d.status === "pending" ? "Decision needed from" : "Decision owner"}>{d.owner || "Not stated"}</Field>
            <Field label="Context">{d.context || "—"}{d.project ? ` · ${d.project}` : ""}</Field>
            <Field label="Why">{d.rationale || <span className="text-muted">No reason was stated in the source.</span>}</Field>
            <Field label="Participants">{d.participants.length ? d.participants.join(", ") : "Not recorded"}</Field>
          </dl>
          <Section title="Related actions" id="d-actions" count={d.related_commitments.length}>
            {d.related_commitments.length ? (
              <ul className="space-y-1 text-sm">
                {d.related_commitments.map((c) => (
                  <li key={c.id}>
                    <Link className="hover:underline" href={`/commitments/${c.id}`}>{c.description}</Link>{" "}
                    <span className="text-muted">· {c.owner} · <StatusText status={c.status} /></span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No actions are linked to this decision yet." />
            )}
          </Section>
          <Section title="Related risks" id="d-risks" count={d.related_risks?.length ?? 0}>
            {d.related_risks?.length ? <ul className="space-y-3">{d.related_risks.map((r) => <RiskCard key={r.id} r={r} />)}</ul> : <Empty title="No open risks reference this decision." />}
          </Section>
          <Section title="Evidence" id="d-evidence" count={d.evidence.length}>
            <EvidenceList evidence={d.evidence} open />
          </Section>
        </>
      )}
    </StateGate>
  );
}
