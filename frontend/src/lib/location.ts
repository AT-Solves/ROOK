"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener("rook:urlchange", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("rook:urlchange", cb);
  };
}

/** Read a query-string parameter without useSearchParams (keeps static shells prerenderable). */
export function useSearchParam(name: string): string | null {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  return new URLSearchParams(search).get(name);
}

/** Update the query string in place and notify readers. */
export function setSearchParam(name: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("rook:urlchange"));
}
