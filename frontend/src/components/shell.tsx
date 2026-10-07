"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";
import type { Me } from "@/lib/types";

/**
 * MVP navigation only (UX §3, C-003): modules without an implemented capability — Projects, People,
 * Briefings, Settings — are hidden. See docs/CONFLICTS.md C-007 for Settings.
 */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/ask", label: "Ask ROOK" },
  { href: "/meetings", label: "Meetings" },
  { href: "/decisions", label: "Decisions" },
  { href: "/commitments", label: "Commitments" },
  { href: "/risks", label: "Risks" },
  { href: "/sources", label: "Sources" },
] as const;

const subscribeNever = () => () => undefined;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-bg font-semibold text-ink" : "text-muted hover:bg-bg hover:text-ink"}`}
            >
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
    <div className="min-h-screen md:grid md:grid-cols-[13rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to main content
      </a>
      <aside className="border-b border-line bg-surface md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:block">
          <Link href="/" className="text-lg font-bold tracking-[0.2em] text-ink">
            ROOK
          </Link>
          <p className="hidden text-xs text-muted md:block">Your AI Chief of Staff</p>
        </div>
        <nav aria-label="Primary" className="px-2 pb-2 md:pb-4">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNav />
          </Suspense>
        </nav>
        <div className="hidden border-t border-line px-4 py-3 text-xs text-muted md:block">
          {me ? (
            <>
              <p className="font-medium text-ink">{me.user.name}</p>
              <p>{me.org.name}</p>
              <p className="mt-1">AI mode: {me.llm === "rules" ? "deterministic rules" : me.llm}</p>
            </>
          ) : null}
          <button type="button" onClick={signOut} className="mt-2 underline">
            Sign out
          </button>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
        {ready ? children : <p className="text-sm text-muted">Connecting…</p>}
      </main>
    </div>
  );
}
