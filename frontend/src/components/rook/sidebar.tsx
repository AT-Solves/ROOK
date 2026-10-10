import Link from "next/link";
import type { ReactNode } from "react";

import { RookLogo } from "./brand";
import { RookIcon, type IconName } from "./icons";
import { RookChessPattern } from "./pattern";

export type RookNavItem = { href: string; label: string; icon: IconName; active: boolean };

/** Navigation list. Active: a lighter Midnight surface, a gold vertical accent, Board Light text, gold icon. */
export function RookNavList({ items }: { items: RookNavItem[] }) {
  return (
    <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
      {items.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            aria-current={n.active ? "page" : undefined}
            className={`relative flex items-center gap-3 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px] transition-colors ${
              n.active
                ? "bg-slate font-semibold text-on-dark before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full before:bg-gold"
                : "font-medium text-on-dark-soft hover:bg-white/[0.04] hover:text-on-dark"
            }`}
          >
            <RookIcon name={n.icon} size={18} className={n.active ? "text-gold" : "text-on-dark-muted"} />
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Profile block at the foot of the sidebar. */
export function RookProfile({ name, org, detail, onSignOut }: { name?: string; org?: string; detail?: string; onSignOut: () => void }) {
  return (
    <div>
    <div className="flex items-center gap-3">
      <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/70 bg-midnight-raised text-[12px] font-semibold tracking-wide text-gold">
        {name ? initials(name) : ""}
      </span>
      <div className="min-w-0 flex-1 text-[12px] leading-snug">
        {name ? <p className="truncate font-semibold text-on-dark">{name}</p> : null}
        {org ? <p className="truncate text-on-dark-muted">{org}</p> : null}
      </div>
    </div>
      {detail ? <p className="mt-3 text-[11px] text-on-dark-muted">{detail}</p> : null}
      <button
        type="button"
        onClick={onSignOut}
        className="-ml-2 mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-medium text-on-dark-soft hover:bg-white/[0.06] hover:text-on-dark"
      >
        <RookIcon name="logout" size={15} className="text-on-dark-muted" />
        Sign out
      </button>
    </div>
  );
}

/**
 * The strategic shell: a Midnight rail with the brand on a faint board, primary navigation, and the profile.
 * On small screens it becomes a top bar with horizontally scrolling navigation.
 */
export function RookSidebar({ nav, profile }: { nav: ReactNode; profile: ReactNode }) {
  return (
    <aside className="rook-dark relative bg-midnight text-on-dark-soft md:border-r md:border-slate-line">
      <div className="md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="relative overflow-hidden px-4 pb-3 pt-4 md:px-6 md:pb-6 md:pt-8">
          <RookChessPattern tone="dark" fade="down" />
          <Link href="/" aria-label="ROOK — Home" className="relative inline-flex rounded-[var(--radius-sm)]">
            <RookLogo tone="dark" size="md" />
          </Link>
          <p className="relative mt-2.5 hidden font-[family-name:var(--font-display)] text-[16px] font-medium text-on-dark-soft md:block">Your AI Chief of Staff</p>
          <span aria-hidden className="rook-gold-rule relative mt-5 hidden md:block" />
        </div>
        <nav aria-label="Primary" className="px-2 pb-2 md:flex-1 md:px-3 md:pb-4">
          {nav}
        </nav>
        <div className="hidden border-t border-slate-line px-4 py-4 md:block">{profile}</div>
      </div>
    </aside>
  );
}
