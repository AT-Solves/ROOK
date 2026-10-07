"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Logo, RookMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { BUTTON, Button } from "@/components/ui";
import { API_BASE, ApiError, api } from "@/lib/api";
import { useSearchParam } from "@/lib/location";
import { safeReturnTo, setToken } from "@/lib/session";
import type { Providers } from "@/lib/types";

export default function LoginPage() {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParam("return_to"));
  const urlError = useSearchParam("error");
  const [formError, setFormError] = useState<string | null>(null);
  const authError = formError ?? urlError;
  const [email, setEmail] = useState("yamini@acme.example");
  const [busy, setBusy] = useState(false);
  const emailId = useId();

  useEffect(() => {
    api.providers().then(setProviders).catch((e) => setLoadError(e instanceof ApiError ? e.message : "ROOK's server is unreachable."));
  }, []);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const { token } = await api.devLogin(email.trim().toLowerCase());
      setToken(token);
      router.replace(returnTo);
    } catch (err) {
      setFormError(err instanceof ApiError && err.kind === "unauthenticated" ? "No ROOK user with that email in the demo workspace." : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  const ms = providers?.providers.find((p) => p.id === "microsoft");
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Identity panel: the ROOK brand on the midnight board. Decorative; the form carries all functionality. */}
      <aside className="surface-dark board-hero relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white lg:min-h-screen lg:px-14 lg:py-14">
        <RookMark tone="outline" size={440} className="pointer-events-none absolute -bottom-16 -right-20 opacity-60" />
        <span className="relative lg:hidden"><Logo surface="dark" size="lg" subtitle tagline /></span>
        <span className="relative hidden lg:block"><Logo surface="dark" size="xl" subtitle tagline /></span>
        <p className="relative mt-10 hidden max-w-md text-[15px] leading-relaxed text-slate-300 lg:block">
          ROOK connects your meetings, messages and work into one evidence-backed view of what was decided, who owns
          what, and what needs your judgment next.
        </p>
      </aside>

      <main id="main" className="board-light flex items-center px-6 py-12 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-midnight">Sign in to ROOK</h1>
          <p className="mt-1 text-sm text-muted">Your AI Chief of Staff — every insight traced to its source.</p>

          {authError ? (
            <p role="alert" className="mt-6 rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-risk bg-surface p-3 text-sm">
              Sign-in didn&apos;t complete: {authError}
            </p>
          ) : null}
          {loadError ? (
            <p role="alert" className="mt-6 rounded-[var(--radius-md)] border border-line border-l-[3px] border-l-risk bg-surface p-3 text-sm">
              {loadError} No action is needed from you if this is temporary — try again shortly.
            </p>
          ) : null}
          {!providers && !loadError ? <p role="status" className="mt-6 text-sm text-muted">Connecting…</p> : null}

          {providers ? (
            <div className="mt-8 space-y-5">
              <section aria-labelledby="sso" className="rounded-[var(--radius-md)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <h2 id="sso" className="flex items-center gap-2 text-sm font-semibold text-midnight">
                  <Icon name="lock" size={16} accent />
                  Sign in with your organisation
                </h2>
                {ms?.configured ? (
                  <a className={`${BUTTON.primary} mt-4 w-full`} href={`${API_BASE}${ms.login_url}?return_to=${encodeURIComponent(returnTo)}`}>
                    <RookMark tone="gold" size={18} />
                    <span>Sign in with Microsoft</span>
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    Microsoft sign-in isn&apos;t configured on this server yet. An administrator needs to complete the steps in
                    docs/integrations/microsoft365.md.
                  </p>
                )}
              </section>
              {providers.dev_login ? (
                <section aria-labelledby="demo" className="rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface/70 p-5">
                  <h2 id="demo" className="text-sm font-semibold text-midnight">Demo workspace</h2>
                  <p className="mt-1 text-xs text-muted">Synthetic data only. Disabled in shared environments.</p>
                  <form onSubmit={devLogin} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor={emailId} className="sr-only">Demo user email</label>
                    <input id={emailId} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 rounded-[10px] border border-line-strong bg-white px-3 py-2 text-sm" />
                    <Button type="submit" variant="action" icon="arrowRight" disabled={busy}>{busy ? "Signing in…" : "Enter demo"}</Button>
                  </form>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
