"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { RookMark } from "@/components/rook";
import { safeReturnTo, setToken } from "@/lib/session";

/** Landing page after Microsoft sign-in. The session token arrives in the URL fragment (never sent to servers). */
export default function AuthComplete() {
  const router = useRouter();
  // The fragment is read once and then cleared. React development mode runs effects twice; without this guard the
  // second run would find no token and report a failed sign-in after the first run had already completed it.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const frag = new URLSearchParams(window.location.hash.slice(1));
    const token = frag.get("token");
    history.replaceState(null, "", window.location.pathname); // drop the token from the address bar and history
    if (!token) {
      router.replace("/login?error=The%20sign-in%20response%20was%20incomplete");
      return;
    }
    setToken(token);
    router.replace(safeReturnTo(frag.get("return_to")));
  }, [router]);
  return (
    <main id="main" className="rook-dark flex min-h-screen items-center justify-center bg-midnight px-4 text-sm text-on-dark-soft">
      <p role="status" className="flex items-center gap-3">
        <RookMark tone="gold" size={28} className="animate-pulse" />
        Connecting…
      </p>
    </main>
  );
}
