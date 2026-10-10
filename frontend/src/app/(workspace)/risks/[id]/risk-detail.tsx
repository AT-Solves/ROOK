"use client";

import { useState } from "react";

import { RecommendationBlock } from "@/components/actions";
import { CommitmentCard, DecisionCard } from "@/components/cards";
import { EvidenceList } from "@/components/evidence";
import { Empty, StateGate } from "@/components/states";
import { RookButton, RookCard, RookField as Field, RookPageHeader, RookSection as Section } from "@/components/rook";
import { LevelPill, StatusText, TrustRow } from "@/components/trust";
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
          <RookPageHeader
            size="detail"
            eyebrow="Risk"
            title={r.title}
            tagline={r.project ?? undefined}
            meta={<TrustRow type={r.claim_type} confidence={r.confidence} basis={r.basis}><LevelPill level={r.level} onDark /></TrustRow>}
          />
          <RookCard as="dl" level={1} flush className="mb-10 px-5 py-1 md:px-6">
            <Field label="Why ROOK detected it">{r.explanation}</Field>
            <Field label="Severity"><LevelPill level={r.level} /></Field>
            <Field label="Status"><StatusText status={r.status} /></Field>
            <Field label="Related project">{r.project ?? <span className="text-muted">Not linked</span>}</Field>
            <Field label="Last updated">{formatDateTime(r.detected_at)}</Field>
          </RookCard>
          <Section title="Suggested next step" id="r-next" icon="target">
            {r.recommended_action ? (
              <RookCard level={2}>
                <RecommendationBlock bare rec={r.recommended_action} riskId={r.id} />
              </RookCard>
            ) : (
              <Empty title="No suggested next step." />
            )}
            {r.status === "open" ? (
              <RookButton
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
              </RookButton>
            ) : null}
          </Section>
          <Section title="Evidence" id="r-evidence" count={r.evidence.length} icon="attachment">
            <EvidenceList evidence={r.evidence} open />
          </Section>
          <Section title="Related commitments" id="r-commitments" count={r.related_commitments?.length ?? 0} icon="checkSquare">
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
