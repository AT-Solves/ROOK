import Link from "next/link";

import { RookIcon, RookSection, RookStatusBadge } from "@/components/rook";
import { ClaimBadge } from "@/components/trust";
import { formatDate, formatTime, isToday } from "@/lib/format";
import type { WatchItem } from "@/lib/situations";
import type { ChangeItem } from "@/lib/types";

/** Watch: what ROOK is monitoring, one row per situation, status in words. */
export function RookWatch({ items }: { items: WatchItem[] }) {
  return (
    <RookSection title="Watch" id="h-watch" count={items.length} icon="risk" more={{ href: "/risks", label: "Risks" }}>
      {items.length ? (
        <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]">
          {items.map((w) => (
            <li key={w.key}>
              <Link href={w.href} className="group flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-board">
                <span className="min-w-0">
                  <span className="block font-semibold text-midnight group-hover:underline group-hover:decoration-gold group-hover:underline-offset-2">{w.title}</span>
                  <span className="block text-[12px] text-muted">{w.detail}</span>
                </span>
                <RookStatusBadge tone={w.status.tone} className="mt-0.5 whitespace-nowrap">
                  {w.status.label}
                </RookStatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 text-[14px] text-muted">ROOK isn&apos;t monitoring any open risks.</p>
      )}
    </RookSection>
  );
}

function when(iso: string | null) {
  if (!iso) return "";
  return isToday(iso) ? formatTime(iso) : formatDate(iso);
}

/** Recent changes: one line each, linked to its source. Each is a FACT stated in that source. */
export function RookRecentChanges({ changes }: { changes: ChangeItem[] }) {
  return (
    <RookSection title="Recent changes" id="h-changes" count={changes.length} icon="status">
      {changes.length ? (
        <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]">
          {changes.map((c) => (
            <li key={c.signal_id} className="grid grid-cols-[5.5rem_1fr] gap-3 px-5 py-3">
              <span className="pt-0.5 text-[12px] font-semibold tabular-nums text-ink-soft">{when(c.occurred_at)}</span>
              <span className="min-w-0">
                <span className="flex items-start gap-2">
                  <ClaimBadge type={c.claim_type} className="mt-0.5" />
                  <Link href={`/evidence/${c.signal_id}`} className="line-clamp-1 text-[13.5px] text-midnight underline-offset-2 decoration-gold hover:underline">
                    {c.summary}
                  </Link>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                  <RookIcon name="attachment" size={12} className="text-chess" />
                  {c.author && c.author !== c.channel ? `${c.channel} · ${c.author}` : c.channel}
                  {c.derived.length ? <span>· ROOK derived: {c.derived.join(", ")}</span> : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 text-[14px] text-muted">No meaningful changes in the last 36 hours.</p>
      )}
    </RookSection>
  );
}
