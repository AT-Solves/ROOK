"use client";

import { RiskCard } from "@/components/cards";
import { Empty, StateGate } from "@/components/states";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

export default function RisksPage() {
  const state = useApi(() => api.risks());
  return (
    <>
      <PageHeader
        title="Risks"
        subtitle="Every risk is ROOK's inference: it states why it was detected and which sources support it. There are no hidden scores."
      />
      <StateGate
        state={state}
        what="the risk radar"
        stage="Analyzing"
        isEmpty={(d) => d.length === 0}
        empty={<Empty title="No open risks.">ROOK raises a risk only when evidence supports it — for example a delayed dependency or an overdue commitment.</Empty>}
      >
        {(risks) => <ul className="space-y-3">{risks.map((r) => <RiskCard key={r.id} r={r} />)}</ul>}
      </StateGate>
    </>
  );
}
