"use client";

import { useState } from "react";

import { RecommendationBlock } from "@/components/actions";
import { CommitmentCard, DecisionCard } from "@/components/cards";
import { EvidenceList } from "@/components/evidence";
import { Empty, StateGate } from "@/components/states";
import { ClaimBadge, ConfidenceLabel, LevelPill, StatusText } from "@/components/trust";
import { Button, Field, PageHeader, Section } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** Risk detail (UX §9): statement, severity, why ROOK detected it, evidence, related items, next step. */
export function RiskDetail({ id }: { id: number }) {
  const state = useApi(() => api.risk(id), [id]);
  const [acking, setAcking] = useState(false);
  return (
    <StateGate state={state} what="this risk" stage="Analyzing">
      {(r) => (
        <>
          <PageHeader module="risks" title={r.title} subtitle={r.project ?? undefined} />
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <ClaimBadge type={r.claim_type} />
            <LevelPill level={r.level} />
            <ConfidenceLabel value={r.confidence} />
            <span className="text-xs text-muted">{r.basis}</span>
          </div>
          <dl className="mb-10 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-1 shadow-[var(--shadow-card)]">
            <Field label="Why ROOK detected it">{r.explanation}</Field>
            <Field label="Severity">{r.level}</Field>
            <Field label="Status"><StatusText status={r.status} /></Field>
            <Field label="Related project">{r.project ?? <span className="text-muted">Not linked</span>}</Field>
            <Field label="Last updated">{formatDateTime(r.detected_at)}</Field>
          </dl>
          <Section title="Suggested next step" id="r-next" icon="target">
            {r.recommended_action ? <RecommendationBlock rec={r.recommended_action} riskId={r.id} /> : <Empty title="No suggested next step." />}
            {r.status === "open" ? (
              <Button
                variant="quiet"
                icon="checkCircle"
                className="mt-3"
                disabled={acking}
                onClick={async () => {
                  setAcking(true);
                  await api.acknowledgeRisk(r.id).catch(() => undefined);
                  setAcking(false);
                  state.reload();
                }}
              >
                Acknowledge
              </Button>
            ) : null}
          </Section>
          <Section title="Evidence" id="r-evidence" count={r.evidence.length} icon="attachment">
            <EvidenceList evidence={r.evidence} open />
          </Section>
          <Section title="Related commitments" id="r-commitments" count={r.related_commitments?.length ?? 0} icon="checkCircle">
            {r.related_commitments?.length ? <ul className="space-y-3">{r.related_commitments.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul> : <Empty title="No commitments are linked to this risk." />}
          </Section>
          <Section title="Related decisions" id="r-decisions" count={r.related_decisions?.length ?? 0} icon="flag">
            {r.related_decisions?.length ? <ul className="space-y-3">{r.related_decisions.map((d) => <DecisionCard key={d.id} d={d} />)}</ul> : <Empty title="No decisions are linked to this risk." />}
          </Section>
        </>
      )}
    </StateGate>
  );
}
