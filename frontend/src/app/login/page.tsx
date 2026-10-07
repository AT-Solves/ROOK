"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { primaryButtonClass, buttonClass } from "@/components/ui";
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
    <main id="main" className="mx-auto mt-16 max-w-md px-4">
      <h1 className="text-3xl font-bold tracking-[0.2em]">ROOK</h1>
      <p className="mt-1 text-sm text-muted">Your AI Chief of Staff. Connect every conversation, decision, commitment, and action.</p>

      {authError ? (
        <p role="alert" className="mt-6 rounded-md border border-line bg-surface p-3 text-sm">
          Sign-in didn&apos;t complete: {authError}
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="mt-6 rounded-md border border-line bg-surface p-3 text-sm">
          {loadError} No action is needed from you if this is temporary — try again shortly.
        </p>
      ) : null}
      {!providers && !loadError ? <p role="status" className="mt-6 text-sm text-muted">Connecting…</p> : null}

      {providers ? (
        <div className="mt-8 space-y-6">
          <section aria-labelledby="sso" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="sso" className="text-sm font-semibold">Sign in with your organisation</h2>
            {ms?.configured ? (
              <a
                className={`${primaryButtonClass} mt-3`}
                href={`${API_BASE}${ms.login_url}?return_to=${encodeURIComponent(returnTo)}`}
              >
                Sign in with Microsoft
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Microsoft sign-in isn&apos;t configured on this server yet. An administrator needs to complete the steps in
                docs/integrations/microsoft365.md.
              </p>
            )}
          </section>
          {providers.dev_login ? (
            <section aria-labelledby="demo" className="rounded-lg border border-dashed border-line p-5">
              <h2 id="demo" className="text-sm font-semibold">Demo workspace</h2>
              <p className="mt-1 text-xs text-muted">Synthetic data only. Disabled in shared environments.</p>
              <form onSubmit={devLogin} className="mt-3 flex gap-2">
                <label htmlFor={emailId} className="sr-only">Demo user email</label>
                <input id={emailId} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm" />
                <button type="submit" className={buttonClass} disabled={busy}>{busy ? "Signing in…" : "Enter demo"}</button>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
