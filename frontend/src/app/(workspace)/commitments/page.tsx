"use client";

import { CommitmentCard } from "@/components/cards";
import { RookPageHeader } from "@/components/rook";
import { Empty, StateGate } from "@/components/states";
import { Tabs, useTab } from "@/components/tabs";
import { api } from "@/lib/api";
import type { Commitment } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const TABS = [
  { id: "mine", label: "Yours" },
  { id: "waiting", label: "Waiting for" },
  { id: "proposed", label: "Suggested by ROOK" },
  { id: "done", label: "Done" },
] as const;
const IDS = TABS.map((t) => t.id);
type TabId = (typeof IDS)[number];

const FILTER: Record<TabId, (c: Commitment) => boolean> = {
  mine: (c) => c.mine && (c.status === "open" || c.status === "overdue"),
  waiting: (c) => !c.mine && (c.status === "open" || c.status === "overdue"),
  proposed: (c) => c.status === "proposed",
  done: (c) => c.status === "done",
};

const EMPTY: Record<TabId, string> = {
  mine: "You have no open commitments.",
  waiting: "You aren't waiting on anyone.",
  proposed: "No suggested actions. ROOK lists inferred actions here; they are never assigned without your approval.",
  done: "No completed commitments yet.",
};

export default function CommitmentsPage() {
  const state = useApi(() => api.commitments("all"));
  const [tab, setTab] = useTab(IDS, "waiting");
  return (
    <>
      <RookPageHeader
        eyebrow="Accountability"
        title="Commitments"
        tagline="Keep promises visible."
        meta={<span className="text-on-dark-muted">Who committed to what, by when, and the source where it was said.</span>}
      />
      <StateGate
        state={state}
        what="commitments"
        isEmpty={(d) => d.length === 0}
        empty={<Empty title="No commitments captured yet.">ROOK tracks explicit commitments made in your meetings and messages.</Empty>}
      >
        {(all) => {
          const counts = Object.fromEntries(IDS.map((t) => [t, all.filter(FILTER[t]).length])) as Record<TabId, number>;
          const shown = all.filter(FILTER[tab]);
          return (
            <>
              <Tabs tabs={TABS} value={tab} onChange={setTab} label="Filter commitments" counts={counts} />
              {tab === "proposed" && shown.length ? (
                <p className="mb-4 border-l-2 border-[var(--inf-mark)] pl-3 text-[13px] text-muted">These are inferences, not commitments anyone made. Open one to assign an owner or dismiss it.</p>
              ) : null}
              {shown.length ? <ul className="space-y-3">{shown.map((c) => <CommitmentCard key={c.id} c={c} showAction={tab === "waiting"} />)}</ul> : <Empty title={EMPTY[tab]} />}
            </>
          );
        }}
      </StateGate>
    </>
  );
}
