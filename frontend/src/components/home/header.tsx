import type { ReactNode } from "react";

import { RookButton, RookChessPattern, RookIcon, RookMark, type IconName } from "@/components/rook";
import { formatTime } from "@/lib/format";
import type { Brief } from "@/lib/types";

/**
 * Executive header: the strategic chessboard band. Restrained compared with Login — the board sits in the upper
 * right and fades out behind the greeting so text keeps full contrast. The pulse docks into its lower edge.
 */
export function RookExecutiveHeader({ b, refreshing, onRefresh, children }: { b: Brief; refreshing: boolean; onRefresh: () => void; children?: ReactNode }) {
  return (
    <header className="rook-dark relative mb-6 overflow-hidden rounded-[var(--radius-lg)] bg-midnight text-on-dark">
      <RookChessPattern variant="dark" fade="right" square={48} />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgb(11_18_32/0.85)_100%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-6 pb-5 pt-6 md:px-9 md:pt-7">
        <div className="min-w-0">
          <p className="rook-caps flex items-center gap-2 text-gold">
            <RookMark tone="gold" size={14} />
            <span>
              ROOK <span aria-hidden className="mx-1 text-on-dark-muted">/</span> Executive brief
            </span>
          </p>
          <h1 className="rook-display mt-2.5 text-[2.2rem] text-ivory md:text-[2.6rem]">{b.greeting}</h1>
          <p className="mt-1.5 text-[16px] text-ivory-soft">
            Here&apos;s what needs your judgment today.<span className="ml-3 text-[13px] text-on-dark-muted">{b.date}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-[12px] text-on-dark-muted">
          <RookButton variant="onDark" icon="refresh" onClick={onRefresh} disabled={refreshing}>
            Refresh
          </RookButton>
          <span role="status">{refreshing ? "Refreshing…" : `Prepared ${formatTime(b.generated_at)}`}</span>
        </div>
      </div>
      {children ? <div className="relative border-t border-slate-line bg-midnight/80">{children}</div> : null}
    </header>
  );
}

export interface PulseItem {
  value: number;
  label: string;
  /** Full accessible name, e.g. "6 items need your attention". */
  name: string;
  href: string;
  icon: IconName;
}

/** Executive pulse: orientation, not content. Each indicator scrolls to its Home region or opens the filtered module. */
export function RookExecutivePulse({ items }: { items: PulseItem[] }) {
  return (
    <nav aria-label="Executive pulse">
      <ul className="grid grid-cols-3 gap-y-1 py-1 sm:grid-cols-5 lg:divide-x lg:divide-slate-line lg:py-0">
        {items.map((p) => (
          <li key={p.label}>
            <a
              href={p.href}
              aria-label={p.name}
              className="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1 px-4 py-2.5 transition-colors hover:bg-white/[0.04] lg:flex lg:gap-3 lg:px-7 lg:py-3"
            >
              <RookIcon name={p.icon} size={17} className="text-gold" />
              <span className="text-[1.5rem] font-semibold leading-none tabular-nums text-ivory">{p.value}</span>
              <span className="rook-caps col-span-2 text-on-dark-soft group-hover:text-ivory">{p.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
