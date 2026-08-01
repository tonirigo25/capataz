"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const online = () => setOffline(false);
    const offlineNow = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineNow);
    let refreshing = false;
    const controllerChanged = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChanged);
    const hostname = window.location.hostname.toLowerCase();
    const appHostname = process.env.NEXT_PUBLIC_APP_HOST?.trim().toLowerCase() || "app.orqenatech.com";
    const platformHostname = hostname.endsWith(".up.railway.app");
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && (hostname === appHostname || platformHostname)) {
      navigator.serviceWorker.register("/service-worker.js").then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) setUpdateWorker(installing);
          });
        });
      }).catch(() => {
        // PWA support is progressive; the app remains usable if registration fails.
      });
    }
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineNow);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  if (!offline && !updateWorker) return null;

  return (
    <div className="pwa-status-stack" aria-live="polite" aria-atomic="true">
      {offline ? (
        <div className="pwa-status-banner pwa-status-banner--offline" role="status">
          Sin conexión. Puedes consultar la pantalla offline, pero Orqena no
          guarda ni envía cambios hasta recuperar la red.
        </div>
      ) : null}
      {updateWorker ? (
        <div className="pwa-status-banner pwa-status-banner--update" role="status">
          <span>Hay una versión nueva de Orqena preparada.</span>
          <span className="pwa-status-banner__actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setUpdateWorker(null)}
            >
              Más tarde
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => updateWorker.postMessage({ type: "SKIP_WAITING" })}
            >
              Actualizar Orqena
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
