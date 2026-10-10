"use client";

import Link from "next/link";

import { RiskCard } from "@/components/cards";
import { EvidenceList } from "@/components/evidence";
import { Empty, StateGate } from "@/components/states";
import { RookCard, RookField as Field, RookPageHeader, RookSection as Section } from "@/components/rook";
import { StatusText, TrustRow } from "@/components/trust";
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
          <RookPageHeader
            size="detail"
            eyebrow={`Decision · ${d.code}`}
            title={d.statement}
            meta={<TrustRow type={d.claim_type} confidence={d.confidence} basis={d.basis}><StatusText status={d.status} onDark /></TrustRow>}
          />
          <RookCard as="dl" level={1} flush className="mb-10 px-5 py-1 md:px-6">
            <Field label="Status"><StatusText status={d.status} />{d.needs_me ? <span className="ml-2 text-[12px] text-muted">· waiting for you</span> : null}</Field>
            <Field label="Date">{formatDateTime(d.decided_at)}</Field>
            <Field label={d.status === "pending" ? "Decision needed from" : "Decision owner"}>{d.owner || "Not stated"}</Field>
            <Field label="Context">{d.context || "—"}{d.project ? ` · ${d.project}` : ""}</Field>
            <Field label="Why">{d.rationale || <span className="text-muted">No reason was stated in the source.</span>}</Field>
            <Field label="Participants">{d.participants.length ? d.participants.join(", ") : "Not recorded"}</Field>
          </RookCard>
          <Section title="Related actions" id="d-actions" count={d.related_commitments.length} icon="checkSquare">
            {d.related_commitments.length ? (
              <RookCard level={2} flush>
                <ul className="divide-y divide-line">
                  {d.related_commitments.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                      <Link className="font-semibold text-midnight underline-offset-2 decoration-gold hover:underline" href={`/commitments/${c.id}`}>{c.description}</Link>
                      <span className="text-[12px] text-muted">{c.owner}</span>
                      <StatusText status={c.status} />
                    </li>
                  ))}
                </ul>
              </RookCard>
            ) : (
              <Empty title="No actions are linked to this decision yet." />
            )}
          </Section>
          <Section title="Related risks" id="d-risks" count={d.related_risks?.length ?? 0} icon="risk">
            {d.related_risks?.length ? <ul className="space-y-3">{d.related_risks.map((r) => <RiskCard key={r.id} r={r} />)}</ul> : <Empty title="No open risks reference this decision." />}
          </Section>
          <Section title="Evidence" id="d-evidence" count={d.evidence.length} icon="attachment">
            <EvidenceList evidence={d.evidence} open />
          </Section>
        </>
      )}
    </StateGate>
  );
}
