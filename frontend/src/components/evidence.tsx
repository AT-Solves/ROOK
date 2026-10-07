import Link from "next/link";

import { formatDateTime } from "@/lib/format";
import type { EvidenceRef } from "@/lib/types";

/** Evidence comes second (UX §17): collapsed by default, one click to the cited sources. */
export function EvidenceList({ evidence, open = false, label = "Evidence" }: { evidence: EvidenceRef[]; open?: boolean; label?: string }) {
  if (!evidence.length) {
    return <p className="text-xs text-muted">No source you can access supports this.</p>;
  }
  return (
    <details className="group text-sm" open={open}>
      <summary className="cursor-pointer select-none text-xs font-medium text-accent hover:underline">
        {label} · {evidence.length} source{evidence.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 space-y-2 border-l-2 border-line pl-3">
        {evidence.map((e, i) => (
          <SourceLine key={`${e.signal_id}-${i}`} e={e} />
        ))}
      </ul>
    </details>
  );
}

export function SourceLine({ e }: { e: EvidenceRef }) {
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Link href={`/evidence/${e.signal_id}`} className="font-medium text-ink underline-offset-2 hover:underline">
          {e.title}
        </Link>
        <span className="text-xs text-muted">
          {e.channel} · {e.author} · {formatDateTime(e.occurred_at)}
        </span>
        {e.note ? <span className="text-xs text-muted">({e.note})</span> : null}
      </div>
      {e.quote ? <blockquote className="mt-0.5 text-[13px] italic text-muted">“{e.quote}”</blockquote> : null}
    </li>
  );
}
