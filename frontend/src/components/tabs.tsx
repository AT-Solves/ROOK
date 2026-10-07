"use client";

import { setSearchParam, useSearchParam } from "@/lib/location";

/** Filter tabs kept in the URL (?tab=) so views are linkable and survive reloads. */
export function useTab<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const raw = useSearchParam("tab");
  const tab = raw && (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;
  return [tab, (t: T) => setSearchParam("tab", t)];
}

export function Tabs<T extends string>({ tabs, value, onChange, label, counts }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string; counts?: Partial<Record<T, number>> }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${value === t.id ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.label}
          {counts?.[t.id] !== undefined ? <span className="ml-1 text-xs text-muted">{counts[t.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}
