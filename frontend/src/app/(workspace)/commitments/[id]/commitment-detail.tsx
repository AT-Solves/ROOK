"use client";

import Link from "next/link";
import { useState } from "react";

import { RiskCard } from "@/components/cards";
import { EvidenceList } from "@/components/evidence";
import { FollowupDraft, FollowupLauncher } from "@/components/followup";
import { Empty, StateGate } from "@/components/states";
import { ClaimBadge, ConfidenceLabel, StatusText } from "@/components/trust";
import { Button, Field, PageHeader, Section } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Commitment } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/** Commitment detail (UX §8), including human-controlled follow-up options. */
export function CommitmentDetail({ id }: { id: number }) {
  const state = useApi(() => api.commitment(id), [id]);
  return (
    <StateGate state={state} what="this commitment">
      {(c) => <Detail c={c} reload={state.reload} />}
    </StateGate>
  );
}

function Detail({ c, reload }: { c: Commitment; reload: () => void }) {
  const delayRisk = c.related_risks?.find((r) => r.recommended_action && "type" in r.recommended_action.action && r.recommended_action.action.type === "draft_followup");
  const drafts = (c.followups ?? []).filter((f) => f.status === "draft");
  const history = (c.followups ?? []).filter((f) => f.status !== "draft");
  return (
    <>
      <PageHeader module="commitments" title={c.description} subtitle={c.project ?? undefined} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ClaimBadge type={c.claim_type} />
        <ConfidenceLabel value={c.confidence} />
        <span className="text-xs text-muted">{c.basis}</span>
      </div>
      <dl className="mb-10 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-1 shadow-[var(--shadow-card)]">
        <Field label="Owner">{c.kind === "inferred" && c.status === "proposed" ? <span className="text-muted">No owner — ROOK inferred this action</span> : c.owner}</Field>
        <Field label="Due">{c.due_date ? formatDate(c.due_date) : "Not stated"}</Field>
        <Field label="Status">
          <StatusText status={c.status} />
          {c.status_basis ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted"><ClaimBadge type={c.status_claim_type} /> {c.status_basis}</span>
          ) : null}
        </Field>
        <Field label="Source">{c.evidence[0] ? `${c.evidence[0].title} (${c.evidence[0].channel})` : "—"}</Field>
        <Field label="Related decision">
          {c.related_decision ? (
            <span>
              <Link className="font-medium text-midnight hover:underline" href={`/decisions/${c.related_decision.id}`}>{c.related_decision.code} · {c.related_decision.statement}</Link>{" "}
              <ClaimBadge type={c.related_decision.claim_type} /> <span className="text-xs text-muted">{c.related_decision.basis}</span>
            </span>
          ) : (
            <span className="text-muted">None linked</span>
          )}
        </Field>
        <Field label="Project">{c.project ?? <span className="text-muted">Not linked</span>}</Field>
      </dl>

      <Section title="Follow-up options" id="c-followup" icon="send">
        <FollowupOptions c={c} riskId={delayRisk?.id} reload={reload} />
        {drafts.map((d) => <FollowupDraft key={d.id} initial={d} />)}
        {history.length ? (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {history.map((h) => <li key={h.id}>{h.title}: {h.status}{h.result ? ` — ${h.result}` : ""}</li>)}
          </ul>
        ) : null}
      </Section>

      <Section title="Related risks" id="c-risks" count={c.related_risks?.length ?? 0} icon="risk">
        {c.related_risks?.length ? <ul className="space-y-3">{c.related_risks.map((r) => <RiskCard key={r.id} r={r} withAction={false} />)}</ul> : <Empty title="No open risks involve this commitment." />}
      </Section>
      <Section title="Evidence" id="c-evidence" count={c.evidence.length} icon="attachment">
        <EvidenceList evidence={c.evidence} open />
      </Section>
    </>
  );
}

function FollowupOptions({ c, riskId, reload }: { c: Commitment; riskId?: number; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }
  if (c.status === "proposed") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">This is an inferred action. It is not tracked until you accept it.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="action" icon="person" disabled={busy} onClick={() => run(() => api.acceptCommitment(c.id))}>Take it on myself</Button>
          <Button variant="quiet" disabled={busy} onClick={() => run(() => api.dismissCommitment(c.id))}>Dismiss</Button>
        </div>
        {error ? <p role="alert" className="text-sm text-[var(--high-ink)]">{error}</p> : null}
      </div>
    );
  }
  if (c.status === "done" || c.status === "dropped") return <p className="text-sm text-muted">No follow-up needed.</p>;
  return (
    <div className="space-y-3">
      {!c.mine ? <FollowupLauncher commitmentId={c.id} riskId={riskId} /> : null}
      <Button variant="quiet" icon="checkCircle" disabled={busy} onClick={() => run(() => api.completeCommitment(c.id))}>Mark as done</Button>
      {error ? <p role="alert" className="text-sm text-[var(--high-ink)]">{error}</p> : null}
    </div>
  );
}
