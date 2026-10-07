import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function Section({
  title,
  count,
  id,
  children,
  more,
}: {
  title: string;
  count?: number;
  id: string;
  children: ReactNode;
  more?: { href: string; label: string };
}) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1">
        <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
          {count !== undefined ? <span className="ml-2 font-normal normal-case tracking-normal">· {count}</span> : null}
        </h2>
        {more ? (
          <Link href={more.href} className="text-xs font-medium text-accent hover:underline">
            {more.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, as: As = "div", className = "" }: { children: ReactNode; as?: "div" | "li" | "article"; className?: string }) {
  return <As className={`rounded-lg border border-line bg-surface p-4 ${className}`}>{children}</As>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1.5 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink sm:mt-0">{children}</dd>
    </div>
  );
}

export const buttonClass =
  "inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50";
export const primaryButtonClass =
  "inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:text-[#0d1117]";
