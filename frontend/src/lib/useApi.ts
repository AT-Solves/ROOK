"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { ApiError } from "./api";

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  key: string | null;
  data: T | null;
  error: ApiError | null;
}

/**
 * Load data from the API boundary with explicit loading / error states (UX §13–14).
 * While reloading, the previous data stays on screen ("refreshing"), so the view never goes blank.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<Result<T>>({ key: null, data: null, error: null });
  const key = JSON.stringify([tick, ...deps]);
  const run = useEffectEvent(load);
  const onUnauthenticated = useEffectEvent(() =>
    router.replace(`/login?return_to=${encodeURIComponent(window.location.pathname)}`),
  );

  useEffect(() => {
    let cancelled = false;
    run()
      .then((data) => !cancelled && setRes({ key, data, error: null }))
      .catch((e: unknown) => {
        if (cancelled) return;
        const error = e instanceof ApiError ? e : new ApiError("server", "Something went wrong while loading this view.");
        setRes((prev) => ({ key, data: prev.data, error }));
        if (error.kind === "unauthenticated") onUnauthenticated();
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const loading = res.key !== key;
  return { data: res.data, error: loading ? null : res.error, loading, reload };
}
