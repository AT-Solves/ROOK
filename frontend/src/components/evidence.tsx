import Link from "next/link";

import { formatDateTime } from "@/lib/format";
import type { EvidenceRef } from "@/lib/types";

import { Icon, type IconName } from "./icons";

/** Evidence type icons (design reference "Evidence type icons"): generic glyphs, no third-party logos. */
const SOURCE_STYLE: { test: (e: Pick<EvidenceRef, "kind" | "channel">) => boolean; icon: IconName; tone: string; label: string }[] = [
  { test: (e) => /teams/i.test(e.channel) && e.kind === "meeting_transcript", icon: "video", tone: "text-[#2563eb]", label: "Meeting" },
  { test: (e) => /teams/i.test(e.channel), icon: "teams", tone: "text-[#6d28d9]", label: "Teams" },
  { test: (e) => e.kind === "meeting_transcript", icon: "video", tone: "text-[#2563eb]", label: "Meeting" },
  { test: (e) => e.kind === "email", icon: "email", tone: "text-[#1d4ed8]", label: "Email" },
  { test: (e) => e.kind === "message", icon: "chat", tone: "text-[#2563eb]", label: "Chat" },
  { test: (e) => e.kind === "document", icon: "document", tone: "text-[#0f766e]", label: "Document" },
  { test: (e) => e.kind === "task_update", icon: "status", tone: "text-midnight", label: "Work item" },
];

export function sourceStyle(e: Pick<EvidenceRef, "kind" | "channel">) {
  return SOURCE_STYLE.find((s) => s.test(e)) ?? { icon: "globe" as IconName, tone: "text-midnight", label: "External" };
}

export function SourceIcon({ e, size = 28 }: { e: Pick<EvidenceRef, "kind" | "channel">; size?: number }) {
  const s = sourceStyle(e);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[8px] border border-line bg-white shadow-[var(--shadow-card)]"
      style={{ width: size, height: size }}
    >
      <Icon name={s.icon} size={Math.round(size * 0.58)} className={s.tone} />
    </span>
  );
}

/** Evidence comes second (UX §17): collapsed by default, one click to the cited sources. */
export function EvidenceList({ evidence, open = false, label = "Evidence" }: { evidence: EvidenceRef[]; open?: boolean; label?: string }) {
  if (!evidence.length) {
    return <p className="text-xs text-muted">No source you can access supports this.</p>;
  }
  return (
    <details className="group text-sm" open={open}>
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-midnight">
        <Icon name="attachment" size={14} accent />
        {label} · {evidence.length} source{evidence.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2.5 space-y-2.5 border-l-2 border-gold/60 pl-3">
        {evidence.map((e, i) => (
          <SourceLine key={`${e.signal_id}-${i}`} e={e} />
        ))}
      </ul>
    </details>
  );
}

export function SourceLine({ e }: { e: EvidenceRef }) {
  return (
    <li className="flex gap-2.5 text-sm">
      <SourceIcon e={e} size={26} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/evidence/${e.signal_id}`} className="font-medium text-ink underline-offset-2 hover:underline">
            {e.title}
          </Link>
          <span className="text-xs text-muted">
            {e.channel} · {e.author} · {formatDateTime(e.occurred_at)}
          </span>
          {e.note ? <span className="text-xs text-muted">({e.note})</span> : null}
        </div>
        {e.quote ? <blockquote className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] italic leading-snug text-ink-soft">“{e.quote}”</blockquote> : null}
      </div>
    </li>
  );
}
