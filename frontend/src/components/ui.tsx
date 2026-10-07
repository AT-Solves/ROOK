import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Icon, type IconName, ModuleTile, type ModuleName } from "./icons";

/* ---------------------------------------------------------------- buttons (design reference "Action buttons") */

export type ButtonVariant = "primary" | "secondary" | "action" | "approve" | "quiet";

const BASE =
  "lift inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55";

/** primary = midnight (Ask ROOK) · secondary = gold (View details) · action = outlined (Draft follow-up) ·
 *  approve = outlined, stronger border (Approve and send) · quiet = text-weight button. Gold is used sparingly. */
export const BUTTON: Record<ButtonVariant, string> = {
  primary: `${BASE} bg-midnight text-white hover:bg-slate`,
  secondary: `${BASE} bg-gold text-midnight hover:bg-[#c9a26b]`,
  action: `${BASE} border border-line-strong bg-white text-midnight hover:bg-board`,
  approve: `${BASE} border-[1.5px] border-midnight bg-white text-midnight hover:bg-board`,
  quiet: `${BASE} px-2 text-ink-soft hover:bg-sunken`,
};

const ICON_TONE: Record<ButtonVariant, string> = {
  primary: "text-gold",
  secondary: "text-midnight",
  action: "text-midnight",
  approve: "text-midnight",
  quiet: "text-muted",
};

function Inner({ icon, variant, rook, children }: { icon?: IconName; variant: ButtonVariant; rook?: ReactNode; children: ReactNode }) {
  return (
    <>
      {rook ?? (icon ? <Icon name={icon} size={18} className={ICON_TONE[variant]} /> : null)}
      <span>{children}</span>
    </>
  );
}

export function Button({
  variant = "action",
  icon,
  rook,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; icon?: IconName; rook?: ReactNode }) {
  return (
    <button type="button" className={`${BUTTON[variant]} ${className}`} {...rest}>
      <Inner icon={icon} variant={variant} rook={rook}>
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  icon,
  href,
  className = "",
  children,
}: {
  variant?: ButtonVariant;
  icon?: IconName;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BUTTON[variant]} ${className}`}>
      <Inner icon={icon} variant={variant}>
        {children}
      </Inner>
    </Link>
  );
}

/** Back-compat class strings for native elements (selects, anchors). */
export const buttonClass = BUTTON.action;
export const primaryButtonClass = BUTTON.primary;

/* ---------------------------------------------------------------- page structure */

/** Page header: module app-icon tile + editorial serif title on a faint board band. */
export function PageHeader({
  title,
  subtitle,
  module,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  module?: ModuleName;
  children?: ReactNode;
}) {
  return (
    <header className="board-light -mx-4 mb-8 border-b border-line px-4 pb-6 pt-2 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          {module ? <ModuleTile module={module} size={44} /> : null}
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-tight tracking-tight text-midnight">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

export function Section({
  title,
  count,
  id,
  children,
  more,
  icon,
}: {
  title: string;
  count?: number;
  id: string;
  children: ReactNode;
  more?: { href: string; label: string };
  icon?: IconName;
}) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 id={id} className="gold-rule flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          {icon ? <Icon name={icon} size={16} accent className="text-midnight" /> : null}
          <span>
            {title}
            {count !== undefined ? <span className="ml-2 font-normal normal-case tracking-normal text-muted">· {count}</span> : null}
          </span>
        </h2>
        {more ? (
          <Link href={more.href} className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft underline-offset-4 hover:underline">
            {more.label}
            <Icon name="chevronRight" size={14} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, as: As = "div", className = "" }: { children: ReactNode; as?: "div" | "li" | "article"; className?: string }) {
  return <As className={`rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] ${className}`}>{children}</As>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink sm:mt-0">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- dashboard counters (reference "Counter tiles") */

const TILE_TONE = {
  risk: "bg-[var(--high-bg)] text-[var(--high-icon)]",
  blue: "bg-[var(--up-bg)] text-[var(--up-icon)]",
  gold: "bg-[var(--rec-bg)] text-[var(--rook-gold-deep)]",
  purple: "bg-[var(--inf-bg)] text-[var(--inf-dot)]",
  green: "bg-[var(--ok-bg)] text-[var(--ok-icon)]",
} as const;

export function CounterTile({ value, label, href, icon, tone }: { value: number; label: string; href: string; icon: IconName; tone: keyof typeof TILE_TONE }) {
  return (
    <a
      href={href}
      className="lift group flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-card)]"
    >
      <span aria-hidden className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] ${TILE_TONE[tone]}`}>
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold leading-none text-midnight">{value}</span>
        <span className="mt-1 block text-xs leading-snug text-muted">{label}</span>
      </span>
      <Icon name="chevronRight" size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
