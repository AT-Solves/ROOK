"use client";

import Link from "next/link";
import { useState } from "react";

import { ActionControl } from "@/components/actions";
import { RookButton, RookButtonLink, RookSection } from "@/components/rook";
import { ClaimBadge } from "@/components/trust";
import type { NextMove } from "@/lib/situations";

/** The control for a move. Drafting opens the existing draft → explicit-approval flow; nothing is sent from here. */
function MoveAction({ m, onDraft }: { m: NextMove; onDraft: () => void }) {
  const action = m.recommendation && "type" in m.recommendation.action ? m.recommendation.action : null;
  const small = "px-3 py-1.5";
  if (action?.type === "draft_followup") {
    return (
      <RookButton variant="strategic" icon="send" onClick={onDraft} className={small}>
        Draft
      </RookButton>
    );
  }
  if (action?.type === "prepare_meeting") {
    return (
      <RookButtonLink href={`/meetings/${action.meeting_id}`} variant="secondary" icon="calendar" className={small}>
        Prepare
      </RookButtonLink>
    );
  }
  if (action?.type === "decide" || action?.type === "review_decision") {
    return (
      <RookButtonLink href={`/decisions/${action.decision_id}`} variant="secondary" icon="flag" className={small}>
        Review
      </RookButtonLink>
    );
  }
  return (
    <RookButtonLink href={m.href} variant="secondary" className={small}>
      Open
    </RookButtonLink>
  );
}

export function RookNextMove({ m, n }: { m: NextMove; n: number }) {
  const [drafting, setDrafting] = useState(false);
  const action = m.recommendation && "type" in m.recommendation.action ? m.recommendation.action : null;
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3 py-3.5 sm:grid-cols-[2rem_1fr_auto]">
      <span aria-hidden className="rook-display pt-0.5 text-[1.35rem] leading-none text-gold-deep">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <ClaimBadge type={m.claimType} />
          <span className="text-[12px] font-semibold text-muted">{m.reason}</span>
          <span aria-hidden className="text-[12px] text-line-strong">·</span>
          <span className="text-[12px] text-muted">{m.situation}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-midnight">
          <Link href={m.href} className="underline-offset-2 decoration-gold hover:underline">
            {m.text}
          </Link>
        </p>
      </div>
      {drafting ? null : (
        <div className="col-start-2 mt-2 sm:col-start-3 sm:mt-0">
          <MoveAction m={m} onDraft={() => setDrafting(true)} />
        </div>
      )}
      {drafting && action ? (
        <div className="col-span-full mt-3 sm:col-start-2">
          <ActionControl action={action} riskId={m.riskId} />
        </div>
      ) : null}
    </li>
  );
}

/** Your next moves: what ROOK believes you should consider, in ROOK's order, each with its reason and claim type. */
export function RookNextMoves({ moves }: { moves: NextMove[] }) {
  return (
    <RookSection title="Your next moves" id="h-moves" count={moves.length} icon="arrowRight">
      {moves.length ? (
        <ol className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface px-5 shadow-[var(--shadow-card)]">
          {moves.map((m, i) => (
            <RookNextMove key={m.key} m={m} n={i + 1} />
          ))}
        </ol>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 text-[14px] text-muted">
          No moves need your judgment right now.
        </p>
      )}
    </RookSection>
  );
}
