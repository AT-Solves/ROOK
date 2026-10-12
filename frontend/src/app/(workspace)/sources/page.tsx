"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Loading } from "@/components/states";

/** Sources now live inside the Context Control Center; keep old links (and their query) working. */
export default function SourcesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/context${window.location.search}`);
  }, [router]);
  return <Loading stage="Connecting" what="Opening the Context Control Center." />;
}
