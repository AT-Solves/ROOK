"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { RookButton, RookChessPattern, RookIcon, RookMark } from "@/components/rook";
import { ApiError, api } from "@/lib/api";
import { getToken } from "@/lib/session";
import type { Me } from "@/lib/types";

/**
 * First-administrator setup (ADR-0011). The first person from a new Microsoft tenant owns the new ROOK organization:
 * they confirm its name, then connect Microsoft 365. The organization is always the caller's own (from the session);
 * nothing here can choose or change the tenant. A personal Microsoft account (ADR-0012) instead sets up its own
 * private workspace: nobody else joins it.
 */
export default function SetupPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [step, setStep] = useState<"confirm" | "connect">("confirm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const personal = me?.org.account_type === "personal";

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login?return_to=%2Fsetup");
      return;
    }
    api
      .me()
      .then((m) => {
        if (!m.org.setup_required) {
          router.replace("/"); // existing organizations and members go straight to their workspace
          return;
        }
        setMe(m);
        setName(m.org.name);
      })
      .catch((e) => (e instanceof ApiError && e.kind === "unauthenticated" ? router.replace("/login") : setError("ROOK's server is unreachable.")));
  }, [router]);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = await api.completeOrgSetup(name.trim());
      setName(org.name);
      setStep("connect");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `ROOK couldn't save your ${personal ? "workspace" : "organization"}.`);
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      window.location.assign((await api.connectDelegated("microsoft365")).authorization_url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the Microsoft 365 connection.");
      setBusy(false);
    }
  }

  return (
    <main id="main" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-board px-5 py-12">
      <RookChessPattern variant="light" fade="radial" opacity={0.5} square={48} className="hidden md:block" />
      <div className="relative w-full max-w-[32rem]">
        <p className="rook-caps flex items-center gap-2 text-gold-deep">
          <RookMark tone="midnight" size={14} />
          {personal ? "Workspace setup" : "Organization setup"} · Step {step === "confirm" ? 1 : 2} of 2
        </p>
        <h1 className="rook-display mt-3 text-[2.25rem] text-midnight">
          {step === "confirm" ? (personal ? "Set up your workspace" : "Set up your organization") : (personal ? "Connect your Microsoft account" : "Connect Microsoft 365")}
        </h1>
        <span aria-hidden className="mt-4 block h-px w-12 bg-gold" />

        {error ? (
          <p role="alert" className="mt-6 border-l-2 border-risk bg-surface px-4 py-3 text-sm text-midnight shadow-[var(--shadow-card)]">
            {error}
          </p>
        ) : null}
        {!me && !error ? <p role="status" className="mt-6 text-sm text-muted">Connecting…</p> : null}

        {me && step === "confirm" ? (
          <form onSubmit={confirm} className="mt-7 rounded-[var(--radius-md)] border border-line bg-surface px-7 pb-7 pt-6 shadow-[var(--shadow-insight)]">
            {personal ? (
              <p className="text-[14px] leading-relaxed text-ink-soft">
                You signed in with a personal Microsoft account, so ROOK created a private workspace that only you can use.
                Nobody else can join it.
              </p>
            ) : (
              <p className="text-[14px] leading-relaxed text-ink-soft">
                You&apos;re the first person from your Microsoft organization to use ROOK, so you are its owner and administrator.
                Colleagues who sign in with the same Microsoft organization join this workspace as members.
              </p>
            )}
            <label htmlFor={nameId} className="mt-5 block text-[13px] font-semibold text-midnight">
              {personal ? "Workspace name" : "Organization name"}
            </label>
            <input
              id={nameId}
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-midnight"
            />
            <p className="mt-1.5 text-[12px] text-muted">
              {personal ? "Only you see this name." : "Suggested from your Microsoft organization. Shown to everyone in this workspace."}
            </p>
            <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Owner</dt>
                <dd className="text-right text-midnight">{me.user.name} · {me.user.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Signed in with</dt>
                <dd className="text-right text-midnight">{personal ? "Personal Microsoft account" : "Microsoft work or school account"}</dd>
              </div>
            </dl>
            <RookButton type="submit" variant="primary" icon="checkCircle" className="mt-6 w-full justify-center py-3" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : personal ? "Confirm workspace" : "Confirm organization"}
            </RookButton>
          </form>
        ) : null}

        {me && step === "connect" ? (
          <section aria-labelledby="connect-title" className="mt-7 rounded-[var(--radius-md)] border border-line bg-surface px-7 pb-7 pt-6 shadow-[var(--shadow-insight)]">
            <h2 id="connect-title" className="flex items-center gap-2.5 text-[15px] font-semibold text-midnight">
              <RookIcon name="checkCircle" size={17} className="text-success" />
              {name} is ready
            </h2>
            {personal ? (
              <>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                  Connect your Outlook mail and calendar so ROOK can build your context. ROOK reads only what you can access, and
                  never sends anything without your approval.
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Meeting transcripts are not available for personal Microsoft accounts.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                  Connect your Microsoft 365 mail, calendar and Teams meetings so ROOK can build your context. ROOK reads only what
                  you can access, and never sends anything without your approval.
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Teams transcripts need your Microsoft administrator&apos;s consent. Without it, ROOK still works and tells you what it can&apos;t read.
                </p>
              </>
            )}
            <RookButton variant="primary" icon="related" className="mt-6 w-full justify-center py-3" onClick={connect} disabled={busy}>
              {busy ? "Connecting…" : personal ? "Connect Outlook mail and calendar" : "Connect Microsoft 365"}
            </RookButton>
            <RookButton variant="quiet" className="mt-2 w-full justify-center" onClick={() => router.replace("/")} disabled={busy}>
              Skip for now
            </RookButton>
          </section>
        ) : null}
      </div>
    </main>
  );
}
