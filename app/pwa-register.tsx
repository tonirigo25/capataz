"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // PWA support is progressive; the app remains usable if registration fails.
      });
    }
  }, []);

  return null;
}
