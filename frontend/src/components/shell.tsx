"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { api } from "@/lib/api";

import { Logo } from "./brand";
import { Icon, MODULES, type ModuleName } from "./icons";
import { clearToken, getToken } from "@/lib/session";
import type { Me } from "@/lib/types";

/**
 * MVP navigation only (UX §3, C-003): modules without an implemented capability — Projects, People,
 * Briefings, Settings — are hidden. See docs/CONFLICTS.md C-007 for Settings.
 */
export const NAV = [
  { href: "/", label: "Home", module: "home" },
  { href: "/ask", label: "Ask ROOK", module: "ask" },
  { href: "/meetings", label: "Meetings", module: "meetings" },
  { href: "/decisions", label: "Decisions", module: "decisions" },
  { href: "/commitments", label: "Commitments", module: "commitments" },
  { href: "/risks", label: "Risks", module: "risks" },
  { href: "/sources", label: "Sources", module: "sources" },
] as const satisfies readonly { href: string; label: string; module: ModuleName }[];

const subscribeNever = () => () => undefined;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 whitespace-nowrap rounded-[8px] px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/[0.08] font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gold"
                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon name={MODULES[n.module].icon} size={18} className={active ? "text-gold" : "text-slate-400"} />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  // Signed in = a session token exists in this tab. Server render has none, so content waits for the client.
  const ready = useSyncExternalStore(subscribeNever, () => !!getToken(), () => false);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/login?return_to=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    api
      .me()
      .then((m) => {
        setMe(m);
        // "Today" is computed in the user's time zone (R08): keep it in sync with the browser.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== m.user.timezone) api.setTimezone(tz).catch(() => undefined);
      })
      .catch(() => undefined); // useApi in each page handles 401 redirects
  }, [router]);

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-midnight">
        Skip to main content
      </a>
      <aside className="surface-dark board-dark text-slate-200">
        <div className="md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
          <Link href="/" aria-label="ROOK — Home" className="inline-flex rounded-[6px]">
            <Logo surface="dark" size="sm" />
          </Link>
          <p className="mt-2 hidden font-[family-name:var(--font-display)] text-[15px] text-slate-300 md:block">Your AI Chief of Staff</p>
        </div>
        <nav aria-label="Primary" className="px-2 pb-2 md:flex-1 md:px-3 md:pb-4">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNav />
          </Suspense>
        </nav>
        <div className="hidden border-t border-white/10 px-5 py-4 text-xs text-slate-300 md:block">
          {me ? (
            <>
              <p className="font-semibold text-white">{me.user.name}</p>
              <p>{me.org.name}</p>
              <p className="mt-1 text-slate-400">AI mode: {me.llm === "rules" ? "deterministic rules" : me.llm}</p>
            </>
          ) : null}
          <button type="button" onClick={signOut} className="mt-2 rounded-[4px] text-slate-200 underline underline-offset-2 hover:text-white">
            Sign out
          </button>
        </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 md:px-8 md:pt-6">
        {/* Always render the page segment (prerendering needs it for instant-navigation validation);
            keep it hidden until a session is confirmed in this tab. Signed-out visitors are redirected. */}
        {ready ? null : <p className="text-sm text-muted">Connecting…</p>}
        <div hidden={!ready}>{children}</div>
      </main>
    </div>
  );
}
