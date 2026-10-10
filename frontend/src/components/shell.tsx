"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";
import type { Me } from "@/lib/types";

import { MODULE_ICON, RookNavList, RookProfile, RookSidebar, type ModuleName } from "./rook";

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
  { href: "/context", label: "Context", module: "sources" },
] as const satisfies readonly { href: string; label: string; module: ModuleName }[];

const subscribeNever = () => () => undefined;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return <RookNavList items={NAV.map((n) => ({ href: n.href, label: n.label, icon: MODULE_ICON[n.module], active: isActive(pathname, n.href) }))} />;
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
    <div className="min-h-screen md:grid md:grid-cols-[var(--sidebar-width)_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-midnight">
        Skip to main content
      </a>
      <RookSidebar
        nav={
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNav />
          </Suspense>
        }
        profile={
          <RookProfile
            name={me?.user.name}
            org={me?.org.name}
            detail={me ? `AI mode: ${me.llm === "rules" ? "deterministic rules" : me.llm}` : undefined}
            onSignOut={signOut}
          />
        }
      />
      <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
        <div className="mx-auto w-full max-w-[var(--content-width)] px-4 pb-16 pt-4 md:px-8 md:pt-8">
          {/* Always render the page segment (prerendering needs it for instant-navigation validation);
              keep it hidden until a session is confirmed in this tab. Signed-out visitors are redirected. */}
          {ready ? null : <p className="text-sm text-muted">Connecting…</p>}
          <div hidden={!ready}>{children}</div>
        </div>
      </main>
    </div>
  );
}
