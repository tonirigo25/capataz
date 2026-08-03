"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const supportedViews = new Set(["evolucion", "rentabilidad", "calidad"]);

export function IntelligenceLegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = url.hash.slice(1);
    if (url.searchParams.has("vista") || !supportedViews.has(hash)) return;
    url.hash = "";
    url.searchParams.set("vista", hash);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [router]);

  return null;
}
