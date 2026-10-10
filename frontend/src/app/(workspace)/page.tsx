"use client";

import { useMemo, useState } from "react";

import { AnswerView, AskForm } from "@/components/ask";
import { RookExecutiveHeader, RookExecutivePulse, type PulseItem } from "@/components/home/header";
import { RookNextMoves } from "@/components/home/moves";
import { RookJudgmentCard } from "@/components/home/situation";
import { RookTodaysMoves } from "@/components/home/today";
import { RookRecentChanges, RookWatch } from "@/components/home/watch";
import { RookSection } from "@/components/rook";
import { StateGate } from "@/components/states";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { buildSituations, nextMoves, primarySituation, watchItems } from "@/lib/situations";
import type { AskAnswer, Brief } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/**
 * Executive Command Center (docs/design/ROOK_HOME_UX_SPEC.md): the brief interpreted as situations.
 * One request (/api/brief) paints the header, pulse and primary situation; preparation and situation detail
 * load afterwards inside their own regions.
 */
export default function HomePage() {
  const brief = useApi(() => api.brief());
  return (
    <StateGate state={brief} what="your brief" stage="Preparing">
      {(b) => <CommandCenter b={b} refreshing={brief.loading} onRefresh={brief.reload} />}
    </StateGate>
  );
}

function pulse(b: Brief): PulseItem[] {
  return [
    { value: b.counts.attention, label: "Attention", name: `${pluralize(b.counts.attention, "item")} need your attention`, href: "#h-moves", icon: "target" },
    { value: b.counts.meetings_today, label: b.counts.meetings_today === 1 ? "Meeting" : "Meetings", name: `${pluralize(b.counts.meetings_today, "meeting")} today`, href: "#h-today", icon: "calendar" },
    { value: b.counts.decisions_pending, label: b.counts.decisions_pending === 1 ? "Decision" : "Decisions", name: `${pluralize(b.counts.decisions_pending, "decision")} pending`, href: "/decisions?tab=pending", icon: "document" },
    { value: b.counts.waiting_for, label: "Waiting", name: `Waiting on others: ${pluralize(b.counts.waiting_for, "commitment")}`, href: "/commitments?tab=waiting", icon: "teams" },
    { value: b.counts.risks, label: "Watch", name: `ROOK is watching ${pluralize(b.counts.risks, "open risk")}`, href: "#h-watch", icon: "risk" },
  ];
}

function CommandCenter({ b, refreshing, onRefresh }: { b: Brief; refreshing: boolean; onRefresh: () => void }) {
  const situations = useMemo(() => buildSituations(b), [b]);
  const primary = primarySituation(situations);
  const moves = useMemo(() => nextMoves(b, situations, 6), [b, situations]);
  const watch = useMemo(() => watchItems(situations), [situations]);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);

  return (
    <>
      <RookExecutiveHeader b={b} refreshing={refreshing} onRefresh={onRefresh}>
        <RookExecutivePulse items={pulse(b)} />
      </RookExecutiveHeader>

      <RookJudgmentCard s={primary} />

      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <RookNextMoves moves={moves} />
        <div>
          <RookTodaysMoves today={b.today} />
          <RookWatch items={watch} />
        </div>
      </div>

      <RookRecentChanges changes={b.changes} />

      <RookSection title="Ask ROOK" id="h-ask" icon="ask">
        <AskForm onAnswer={setAnswer} compact placeholder="Ask ROOK anything else…" />
        <div aria-live="polite">{answer ? <div className="mt-4"><AnswerView a={answer} /></div> : null}</div>
      </RookSection>
    </>
  );
}
