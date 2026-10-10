import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { RookIcon, type IconName } from "./icons";

/**
 * Buttons — restrained, three intents plus quiet variants:
 *  primary   Midnight, Board Light text, gold icon      (Ask ROOK, Approve and send)
 *  secondary warm off-white, Midnight text, hairline     (View, Sync, Open meeting preparation)
 *  strategic Rook Gold, Midnight text                    (Draft follow-up, Sign in with Microsoft)
 *  quiet     text-weight action on light surfaces        (Discard, Dismiss, Mark as done)
 *  onDark    hairline button for dark headers            (Refresh)
 */
export type RookButtonVariant = "primary" | "secondary" | "strategic" | "quiet" | "onDark";

const BASE =
  "rook-interactive inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-2 text-[13px] font-semibold tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-55";

export const ROOK_BUTTON: Record<RookButtonVariant, string> = {
  primary: `${BASE} bg-midnight text-on-dark hover:bg-slate`,
  secondary: `${BASE} border border-line-strong bg-surface text-midnight hover:border-midnight/40 hover:bg-board`,
  strategic: `${BASE} bg-gold text-midnight hover:bg-gold-soft`,
  quiet: `${BASE} px-2.5 font-medium text-ink-soft hover:bg-sunken hover:text-midnight`,
  onDark: `${BASE} border border-white/20 bg-white/[0.04] font-medium text-on-dark hover:border-gold/60 hover:bg-white/[0.08]`,
};

const ICON_TONE: Record<RookButtonVariant, string> = {
  primary: "text-gold",
  secondary: "text-midnight",
  strategic: "text-midnight",
  quiet: "text-muted",
  onDark: "text-gold",
};

function Inner({ icon, variant, lead, children }: { icon?: IconName; variant: RookButtonVariant; lead?: ReactNode; children: ReactNode }) {
  return (
    <>
      {lead ?? (icon ? <RookIcon name={icon} size={16} strokeWidth={1.9} className={ICON_TONE[variant]} /> : null)}
      <span>{children}</span>
    </>
  );
}

export function RookButton({
  variant = "secondary",
  icon,
  lead,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: RookButtonVariant; icon?: IconName; lead?: ReactNode }) {
  return (
    <button type="button" className={`${ROOK_BUTTON[variant]} ${className}`} {...rest}>
      <Inner icon={icon} variant={variant} lead={lead}>
        {children}
      </Inner>
    </button>
  );
}

export function RookButtonLink({
  variant = "secondary",
  icon,
  lead,
  href,
  className = "",
  children,
}: {
  variant?: RookButtonVariant;
  icon?: IconName;
  lead?: ReactNode;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${ROOK_BUTTON[variant]} ${className}`}>
      <Inner icon={icon} variant={variant} lead={lead}>
        {children}
      </Inner>
    </Link>
  );
}
