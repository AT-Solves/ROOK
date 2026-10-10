"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ROOK_BUTTON, RookButton, RookChessPattern, RookHeroPiece, RookIcon, RookMark } from "@/components/rook";
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
    <div className="min-h-screen bg-board md:grid md:grid-cols-[45fr_55fr] lg:grid-cols-[55fr_45fr]">
      <BrandPanel />

      {/* Executive sign-in: Board Light workspace, content vertically centred. */}
      <main id="main" className="relative flex items-center justify-center overflow-hidden px-5 py-10 md:px-10 md:py-14">
        <RookChessPattern variant="light" fade="radial" opacity={0.55} square={48} className="hidden md:block" />
        <div className="relative w-full max-w-[27rem]">
          <p className="rook-caps flex items-center gap-2 text-gold-deep">
            <RookMark tone="midnight" size={14} />
            Secure sign-in
          </p>
          <h1 className="rook-display mt-3 text-[2.5rem] text-midnight">Sign in to ROOK</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Your AI Chief of Staff — every insight traced to its source.</p>
          <span aria-hidden className="mt-5 block h-px w-12 bg-gold" />

          {authError ? (
            <p role="alert" className="mt-6 border-l-2 border-risk bg-surface px-4 py-3 text-sm text-midnight shadow-[var(--shadow-card)]">
              Sign-in didn&apos;t complete: {authError}
            </p>
          ) : null}
          {loadError ? (
            <p role="alert" className="mt-6 border-l-2 border-risk bg-surface px-4 py-3 text-sm text-midnight shadow-[var(--shadow-card)]">
              {loadError} No action is needed from you if this is temporary — try again shortly.
            </p>
          ) : null}
          {!providers && !loadError ? <p role="status" className="mt-6 text-sm text-muted">Connecting…</p> : null}

          {providers ? (
            <div className="mt-7 rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-insight)]">
              <section aria-labelledby="sso" className="px-7 pb-7 pt-6">
                <h2 id="sso" className="flex items-center gap-2.5 text-[15px] font-semibold text-midnight">
                  <RookIcon name="lock" size={17} className="text-gold-deep" />
                  Sign in with your organisation
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  Use your Microsoft 365 work account. ROOK only shows what you can already open in your own systems.
                </p>
                {ms?.configured ? (
                  <a className={`${ROOK_BUTTON.primary} mt-5 w-full py-3 text-[14px]`} href={`${API_BASE}${ms.login_url}?return_to=${encodeURIComponent(returnTo)}`}>
                    <RookMark tone="gold" size={18} />
                    <span>Sign in with Microsoft</span>
                  </a>
                ) : (
                  <p className="mt-5 border-l-2 border-gold bg-sunken px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                    Microsoft sign-in isn&apos;t configured on this server yet. An administrator needs to complete the steps in
                    docs/integrations/microsoft365.md.
                  </p>
                )}
              </section>
              {providers.dev_login ? (
                <section aria-labelledby="demo" className="border-t border-line bg-board/60 px-7 pb-7 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="demo" className="text-[15px] font-semibold text-midnight">Demo workspace</h2>
                    <span className="rook-caps rounded-[var(--radius-xs)] bg-midnight px-2 py-1 text-[10px] text-gold">Synthetic data</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Explore ROOK with the Acme demo organisation. Disabled in shared environments.</p>
                  <form onSubmit={devLogin} className="mt-4">
                    <label htmlFor={emailId} className="block text-[12px] font-semibold text-ink-soft">Demo user email</label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        id={emailId}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-sm text-midnight focus:border-gold-deep"
                      />
                      <RookButton type="submit" variant="secondary" icon="arrowRight" disabled={busy} className="py-2.5">{busy ? "Signing in…" : "Enter demo"}</RookButton>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          ) : null}

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted">
            {["Permission-aware", "Evidence for every insight", "Nothing sent without your approval"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 bg-gold" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

/**
 * Brand panel: Midnight board at hero scale (layer 1), vignette for depth and legibility (layer 2),
 * logo and message (layer 3), the sculpted rook anchoring the composition (layer 4).
 * On phones it becomes a compact board header that keeps the chess identity.
 */
function BrandPanel() {
  return (
    <aside aria-label="ROOK" className="rook-dark relative isolate overflow-hidden bg-midnight text-ivory md:min-h-screen">
      <RookChessPattern variant="hero" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgb(11_18_32/0.92)_0%,rgb(11_18_32/0.62)_38%,rgb(11_18_32/0.18)_70%,rgb(11_18_32/0.05)_100%)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_78%,rgb(212_175_124/0.10)_0%,transparent_45%),linear-gradient(180deg,transparent_55%,rgb(11_18_32/0.75)_100%)]" />

      <RookHeroPiece className="pointer-events-none absolute bottom-[7%] right-[5%] hidden h-[50%] max-h-[520px] drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)] lg:block" />
      <RookHeroPiece className="pointer-events-none absolute left-1/2 top-[27%] hidden h-[36%] -translate-x-1/2 drop-shadow-[0_24px_32px_rgb(0_0_0/0.45)] md:block lg:hidden" />
      <RookHeroPiece className="pointer-events-none absolute bottom-5 right-5 h-[56%] drop-shadow-[0_16px_20px_rgb(0_0_0/0.45)] md:hidden" />

      <div className="relative flex h-full flex-col justify-between gap-10 px-6 py-8 md:px-12 md:py-14 lg:px-16">
        <div>
          <div className="flex items-center gap-4">
            <RookMark tone="gold" size={56} className="h-11 w-11 md:h-14 md:w-14" />
            <span className="rook-wordmark text-[2.5rem] text-ivory md:text-[3.25rem]">ROOK</span>
          </div>
          <p className="mt-3 font-[family-name:var(--font-display)] text-[1.35rem] font-medium text-ivory md:text-[1.75rem]">Your AI Chief of Staff</p>
        </div>

        <div className="hidden max-w-[24rem] md:block lg:max-w-[22rem] xl:max-w-[24rem]">
          <p className="rook-caps text-[12px] text-gold">Context for higher judgment</p>
          <span aria-hidden className="mt-3 block h-px w-24 bg-gold" />
          <p className="mt-5 text-[17px] leading-relaxed text-ivory-soft">
            ROOK connects the conversations, decisions and commitments that shape your organization—so you know what matters
            and what needs your judgment next.
          </p>
        </div>
        <div className="md:hidden">
          <p className="rook-caps text-gold">Context for higher judgment</p>
          <span aria-hidden className="mt-2.5 block h-px w-16 bg-gold" />
        </div>
      </div>
    </aside>
  );
}
