"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  const pathname = usePathname();
  useReportWebVitals((metric) => {
    const payload = JSON.stringify({ id: metric.id, metric: metric.name, value: metric.value, rating: metric.rating, routeGroup: routeGroup(pathname) });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/metrics/web-vitals", new Blob([payload], { type: "application/json" }));
    else void fetch("/api/metrics/web-vitals", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" });
  });
  return null;
}

function routeGroup(pathname: string) {
  if (["/login", "/registro", "/recuperar-contrasena", "/restablecer-contrasena"].some((route) => pathname.startsWith(route))) return "auth";
  if (pathname.startsWith("/plataforma")) return "platform";
  if (["/hoy", "/clientes", "/obras", "/documentos", "/dinero", "/configuracion"].some((route) => pathname.startsWith(route))) return "app";
  return "public";
}
