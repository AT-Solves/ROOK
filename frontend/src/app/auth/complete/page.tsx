"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { safeReturnTo, setToken } from "@/lib/session";

/** Landing page after Microsoft sign-in. The session token arrives in the URL fragment (never sent to servers). */
export default function AuthComplete() {
  const router = useRouter();
  useEffect(() => {
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
    <main id="main" className="mx-auto mt-16 max-w-md px-4 text-sm">
      <p role="status">Connecting…</p>
    </main>
  );
}
