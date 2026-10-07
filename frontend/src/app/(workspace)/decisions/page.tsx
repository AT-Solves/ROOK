"use client";

import { DecisionCard } from "@/components/cards";
import { Empty, StateGate } from "@/components/states";
import { Tabs, useTab } from "@/components/tabs";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "made", label: "Decided" },
  { id: "all", label: "All" },
] as const;
const IDS = TABS.map((t) => t.id);

export default function DecisionsPage() {
  const state = useApi(() => api.decisions());
  const [tab, setTab] = useTab(IDS, "pending");
  return (
    <>
      <PageHeader module="decisions" title="Decisions" subtitle="The decision register: what was decided, by whom, why, and where it was stated." />
      <StateGate
        state={state}
        what="the decision register"
        isEmpty={(d) => d.length === 0}
        empty={<Empty title="No decisions captured yet.">ROOK will add decisions when they are detected from your connected sources.</Empty>}
      >
        {(all) => {
          const shown = tab === "all" ? all : all.filter((d) => d.status === tab);
          const counts = { pending: all.filter((d) => d.status === "pending").length, made: all.filter((d) => d.status === "made").length, all: all.length };
          return (
            <>
              <Tabs tabs={TABS} value={tab} onChange={setTab} label="Filter decisions" counts={counts} />
              {shown.length ? <ul className="space-y-3">{shown.map((d) => <DecisionCard key={d.id} d={d} />)}</ul> : <Empty title={tab === "pending" ? "No decisions are pending." : "No decisions in this view."} />}
            </>
          );
        }}
      </StateGate>
    </>
  );
}
