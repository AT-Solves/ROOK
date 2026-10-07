import Link from "next/link";
import type { ReactNode } from "react";

import type { ClaimType, Confidence, EvidenceRef } from "@/lib/types";

import { EvidenceList } from "./evidence";
import { ClaimBadge, ConfidenceLabel } from "./trust";

/** One insight card: what (with its claim type) → why → evidence → action. */
export function InsightCard({
  title,
  href,
  claimType,
  confidence,
  meta,
  why,
  evidence,
  children,
  as: As = "li",
}: {
  title: string;
  href?: string;
  claimType: ClaimType;
  confidence?: Confidence;
  meta?: ReactNode;
  why?: ReactNode;
  evidence?: EvidenceRef[];
  children?: ReactNode;
  as?: "li" | "article" | "div";
}) {
  return (
    <As className="lift rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <ClaimBadge type={claimType} className="self-start" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-midnight">
            {href ? (
              <Link href={href} className="underline-offset-2 hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </p>
          {meta || confidence ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              {meta}
              {confidence ? <ConfidenceLabel value={confidence} /> : null}
            </div>
          ) : null}
        </div>
      </div>
      {why ? <div className="mt-2.5 text-sm leading-relaxed text-ink-soft">{why}</div> : null}
      {evidence ? <div className="mt-2.5">{<EvidenceList evidence={evidence} />}</div> : null}
      {children}
    </As>
  );
}
