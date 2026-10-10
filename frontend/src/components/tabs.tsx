"use client";

import { setSearchParam, useSearchParam } from "@/lib/location";

/** Filter tabs kept in the URL (?tab=) so views are linkable and survive reloads. */
export function useTab<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const raw = useSearchParam("tab");
  const tab = raw && (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;
  return [tab, (t: T) => setSearchParam("tab", t)];
}

/** Segmented filter: active tab carries a gold underline and Midnight text. */
export function Tabs<T extends string>({ tabs, value, onChange, label, counts }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string; counts?: Partial<Record<T, number>> }) {
  return (
    <div role="group" aria-label={label} className="mb-5 flex flex-wrap gap-x-1 border-b border-line">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.id)}
            className={`-mb-px rounded-t-[var(--radius-xs)] border-b-2 px-3.5 py-2 text-[13px] transition-colors ${on ? "border-gold font-semibold text-midnight" : "border-transparent font-medium text-muted hover:text-midnight"}`}
          >
            {t.label}
            {counts?.[t.id] !== undefined ? <span className={`ml-1.5 text-[12px] tabular-nums ${on ? "text-ink-soft" : "text-muted"}`}>{counts[t.id]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
