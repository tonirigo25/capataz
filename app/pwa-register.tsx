"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const appHostname = process.env.NEXT_PUBLIC_APP_HOST?.trim().toLowerCase() || "app.orqenatech.com";
    const platformHostname = hostname.endsWith(".up.railway.app");
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && (hostname === appHostname || platformHostname)) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // PWA support is progressive; the app remains usable if registration fails.
      });
    }
  }, []);

  return null;
}
