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
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
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

  return <>
    {offline ? <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-xl border border-warning bg-surface-raised p-3 text-sm shadow-xl" role="status">Sin conexión. Puedes consultar la pantalla offline, pero Orqena no guarda ni envía cambios hasta recuperar la red.</div> : null}
    {updateWorker ? <div className="fixed inset-x-3 bottom-3 z-[101] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-brand bg-surface-raised p-3 text-sm shadow-xl" role="status"><span>Hay una versión nueva de Orqena preparada.</span><span className="flex gap-2"><button className="ghost-button" type="button" onClick={() => setUpdateWorker(null)}>Más tarde</button><button className="primary-button" type="button" onClick={() => updateWorker.postMessage({ type: "SKIP_WAITING" })}>Actualizar Orqena</button></span></div> : null}
  </>;
}
