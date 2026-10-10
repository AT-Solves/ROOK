"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ROOK_BUTTON, RookButton, RookChessPattern, RookIcon, RookLogo, RookMark } from "@/components/rook";
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
    <div className="rook-dark relative min-h-screen overflow-hidden bg-midnight text-on-dark-soft">
      {/* The board: chess geometry fading out from the right; decorative only. */}
      <RookChessPattern tone="dark" fade="radial" />
      <span aria-hidden className="pointer-events-none absolute -right-40 top-1/2 h-[46rem] w-[46rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(212_175_124/0.10)_0%,transparent_60%)]" />
      <main id="main" className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-6 py-14 lg:flex-row lg:justify-between lg:gap-16 lg:px-10">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="lg:hidden"><RookLogo tone="dark" size="lg" subtitle tagline stacked /></span>
          <span className="hidden lg:block"><RookLogo tone="dark" size="xl" subtitle tagline /></span>
          <p className="mt-10 hidden max-w-md text-[15px] leading-relaxed text-on-dark-soft lg:block">
            ROOK connects your meetings, messages and work into one evidence-backed view of what was decided, who owns
            what, and what needs your judgment next.
          </p>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-[var(--radius-lg)] border border-slate-line bg-midnight-raised/90 p-7 shadow-[var(--shadow-raised)] backdrop-blur-sm">
            <h1 className="rook-display text-[2rem] text-on-dark">Sign in to ROOK</h1>
            <p className="mt-1.5 text-[14px] text-on-dark-soft">Every insight traced to its source.</p>
            <span aria-hidden className="rook-gold-rule mt-5" />

            {authError ? (
              <p role="alert" className="mt-5 border-l-2 border-risk bg-white/[0.04] px-3 py-2.5 text-sm text-on-dark">
                Sign-in didn&apos;t complete: {authError}
              </p>
            ) : null}
            {loadError ? (
              <p role="alert" className="mt-5 border-l-2 border-risk bg-white/[0.04] px-3 py-2.5 text-sm text-on-dark">
                {loadError} No action is needed from you if this is temporary — try again shortly.
              </p>
            ) : null}
            {!providers && !loadError ? <p role="status" className="mt-5 text-sm text-on-dark-muted">Connecting…</p> : null}

            {providers ? (
              <div className="mt-6 space-y-6">
                <section aria-labelledby="sso">
                  <h2 id="sso" className="flex items-center gap-2 text-[13px] font-semibold text-on-dark">
                    <RookIcon name="lock" size={15} className="text-gold" />
                    Sign in with your organisation
                  </h2>
                  {ms?.configured ? (
                    <a className={`${ROOK_BUTTON.strategic} mt-3.5 w-full py-2.5 text-[14px]`} href={`${API_BASE}${ms.login_url}?return_to=${encodeURIComponent(returnTo)}`}>
                      <RookMark tone="midnight" size={18} />
                      <span>Sign in with Microsoft</span>
                    </a>
                  ) : (
                    <p className="mt-2 text-[13px] leading-relaxed text-on-dark-muted">
                      Microsoft sign-in isn&apos;t configured on this server yet. An administrator needs to complete the steps in
                      docs/integrations/microsoft365.md.
                    </p>
                  )}
                </section>
                {providers.dev_login ? (
                  <section aria-labelledby="demo" className="border-t border-slate-line pt-5">
                    <h2 id="demo" className="text-[13px] font-semibold text-on-dark">Demo workspace</h2>
                    <p className="mt-1 text-[12px] text-on-dark-muted">Synthetic data only. Disabled in shared environments.</p>
                    <form onSubmit={devLogin} className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label htmlFor={emailId} className="sr-only">Demo user email</label>
                      <input
                        id={emailId}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-slate-line bg-midnight px-3 py-2 text-sm text-on-dark placeholder:text-on-dark-muted focus:border-gold"
                      />
                      <RookButton type="submit" variant="onDark" icon="arrowRight" disabled={busy}>{busy ? "Signing in…" : "Enter demo"}</RookButton>
                    </form>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
