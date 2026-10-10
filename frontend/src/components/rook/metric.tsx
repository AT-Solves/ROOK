import { RookIcon, type IconName } from "./icons";

/**
 * Executive metric card: one uniform surface for every metric (no per-card pastel colours). Icon in a hairline
 * square, large number, concise caps label, chevron; gold underline and border on hover/focus.
 */
export function RookMetricCard({ value, label, href, icon }: { value: number; label: string; href: string; icon: IconName }) {
  return (
    <a href={href} className="rook-metric group relative flex flex-col gap-4 rounded-[var(--radius-md)] border border-line bg-surface px-4 pb-4 pt-3.5 shadow-[var(--shadow-card)]">
      <span className="flex items-center justify-between">
        <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-board text-midnight">
          <RookIcon name={icon} size={17} />
        </span>
        <RookIcon name="chevronRight" size={16} className="text-chess transition-transform group-hover:translate-x-0.5 group-hover:text-gold-deep" />
      </span>
      <span>
        <span className="block text-[2rem] font-semibold leading-none tabular-nums tracking-tight text-midnight">{value}</span>
        <span className="rook-caps mt-2 block leading-snug text-muted">{label}</span>
      </span>
    </a>
  );
}
