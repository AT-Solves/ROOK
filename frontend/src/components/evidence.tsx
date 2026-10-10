import { formatDateTime } from "@/lib/format";
import type { EvidenceRef } from "@/lib/types";

import { RookEvidence, RookSourceIcon, RookSourceLine, sourceType } from "./rook";

export { sourceType as sourceStyle };

export function SourceIcon({ e, size = 28 }: { e: Pick<EvidenceRef, "kind" | "channel">; size?: number }) {
  return <RookSourceIcon e={e} size={size} />;
}

/** Evidence comes second (UX §17): collapsed by default, one click to the cited sources. */
export function EvidenceList({ evidence, open = false, label = "Evidence" }: { evidence: EvidenceRef[]; open?: boolean; label?: string }) {
  if (!evidence.length) {
    return <p className="text-[12px] text-muted">No source you can access supports this.</p>;
  }
  return (
    <RookEvidence open={open} summary={`${label} · ${evidence.length} source${evidence.length === 1 ? "" : "s"}`}>
      {evidence.map((e, i) => (
        <SourceLine key={`${e.signal_id}-${i}`} e={e} />
      ))}
    </RookEvidence>
  );
}

export function SourceLine({ e }: { e: EvidenceRef }) {
  return (
    <RookSourceLine
      e={e}
      href={`/evidence/${e.signal_id}`}
      title={e.title}
      meta={`${e.channel} · ${e.author} · ${formatDateTime(e.occurred_at)}${e.note ? ` · ${e.note}` : ""}`}
      quote={e.quote || undefined}
    />
  );
}
