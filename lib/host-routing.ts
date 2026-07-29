export const MARKETING_HOST = "orqenatech.com";
export const MARKETING_WWW_HOST = "www.orqenatech.com";
export const APP_HOST = "app.orqenatech.com";
export const DEFENSIVE_HOSTS = new Set([
  "orqena.es",
  "www.orqena.es",
  "orqenatech.es",
  "www.orqenatech.es",
  "orquenatech.com",
  "www.orquenatech.com",
]);

export const LAUNCH_MARKETING_PATHS = new Set([
  "/",
  "/capataz",
  "/funcionalidades",
  "/para-autonomos",
  "/para-empresas",
  "/precios",
  "/contacto",
  "/legal/aviso-legal",
  "/legal/privacidad",
  "/legal/cookies",
  "/legal/terminos",
  "/estado",
]);

const LEGACY_MARKETING_PREFIXES = [
  "/producto",
  "/soluciones",
  "/sectores",
  "/planes",
  "/seguridad",
  "/demo",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/politicas",
  "/soporte",
] as const;

const APP_PAGE_PREFIXES = [
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
  "/verificar-email",
  "/aceptar-invitacion",
  "/acceso-pendiente",
  "/acceso-restringido",
  "/actividad",
  "/agenda",
  "/alertas",
  "/auditoria",
  "/automatizaciones",
  "/buscar",
  "/clientes",
  "/configuracion",
  "/crear-empresa",
  "/dashboard",
  "/demo-guiada",
  "/dinero",
  "/documentos",
  "/equipo",
  "/equipos",
  "/facturas-proveedor",
  "/facturas-subcontratas",
  "/gastos-materiales",
  "/gestion",
  "/hoy",
  "/inteligencia",
  "/notificaciones",
  "/obras",
  "/onboarding",
  "/plan-y-uso",
  "/plataforma",
  "/presupuestos",
  "/proveedores",
  "/recomendaciones",
  "/recordatorios",
  "/seguimientos",
  "/seleccionar-empresa",
  "/subcontratas",
  "/tareas",
  "/tesoreria",
] as const;

const SHARED_STATIC_PREFIXES = ["/_next/", "/brand/", "/marketing/", "/icons/"] as const;
const SHARED_STATIC_EXACT = new Set(["/favicon.ico", "/.well-known/security.txt"]);
const APP_PWA_PATHS = new Set(["/manifest.webmanifest", "/service-worker.js", "/offline.html"]);
const SHARED_HEALTH_PATHS = new Set([
  "/api/status",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
]);
const MARKETING_API_PATHS = new Set(["/api/marketing/contact", "/api/demo-requests"]);

export type HostRoutingDecision =
  | { action: "pass"; site: "app" | "marketing" | "platform" }
  | { action: "rewrite"; pathname: string; site: "marketing" }
  | { action: "redirect"; location: string; status: 301 | 307 }
  | { action: "reject"; status: 404 | 421; site: "app" | "marketing" | "unknown" }
  | { action: "robots"; site: "app" };

export function normalizeRequestHost(value: string | null | undefined) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw || raw.includes("/") || raw.includes("\\") || raw.includes("@") || /[\s\u0000-\u001f]/.test(raw)) return "";
  if (raw.startsWith("[")) {
    const closing = raw.indexOf("]");
    return closing >= 0 ? raw.slice(0, closing + 1) : "";
  }
  return raw.split(":")[0] ?? "";
}

export function resolveHostRouting(input: {
  host: string;
  pathname: string;
  search?: string;
  nodeEnv?: string;
  developmentSite?: "app" | "marketing";
  hasSessionCookie?: boolean;
}): HostRoutingDecision {
  const host = normalizeRequestHost(input.host);
  const pathname = normalizePathname(input.pathname);
  const search = normalizeSearch(input.search);

  // Railway health probes use an internal hostname rather than the public
  // service domain. Keep only the explicit liveness/readiness surface
  // host-agnostic so load-balancer validation can reach the application.
  if (SHARED_HEALTH_PATHS.has(pathname)) {
    return { action: "pass", site: "platform" };
  }

  if (host === MARKETING_WWW_HOST || DEFENSIVE_HOSTS.has(host)) {
    return { action: "redirect", location: `${marketingUrl(pathname)}${search}`, status: 301 };
  }

  if (host === MARKETING_HOST || input.developmentSite === "marketing") {
    return marketingDecision(pathname, search);
  }

  if (host === APP_HOST || input.developmentSite === "app") {
    return appDecision(pathname, search);
  }

  if (isPlatformHost(host)) {
    return platformDecision(pathname, search, Boolean(input.hasSessionCookie));
  }

  if (input.nodeEnv !== "production" && isLocalHost(host)) {
    return { action: "pass", site: "platform" };
  }

  return { action: "reject", status: 421, site: "unknown" };
}

export function isLaunchMarketingPath(pathname: string) {
  return LAUNCH_MARKETING_PATHS.has(normalizePathname(pathname));
}

export function internalMarketingPath(pathname: string) {
  const normalized = normalizePathname(pathname);
  return normalized === "/" ? "/marketing-internal" : `/marketing-internal${normalized}`;
}

export function isPlatformHost(host: string) {
  return host.endsWith(".up.railway.app");
}

function platformDecision(pathname: string, search: string, hasSessionCookie: boolean): HostRoutingDecision {
  if (pathname === "/capataz" && hasSessionCookie) {
    return { action: "pass", site: "app" };
  }
  if (isLaunchMarketingPath(pathname)) {
    return { action: "rewrite", pathname: internalMarketingPath(pathname), site: "marketing" };
  }
  if (isLegacyMarketingPath(pathname)) {
    return { action: "pass", site: "marketing" };
  }
  return { action: "pass", site: "platform" };
}

function marketingDecision(pathname: string, search: string): HostRoutingDecision {
  if (SHARED_HEALTH_PATHS.has(pathname) || MARKETING_API_PATHS.has(pathname) || isSharedStatic(pathname)) {
    return { action: "pass", site: "marketing" };
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return { action: "rewrite", pathname: internalMarketingPath(pathname), site: "marketing" };
  }
  if (APP_PWA_PATHS.has(pathname) || pathname.startsWith("/api/")) {
    return { action: "reject", status: 404, site: "marketing" };
  }
  if (isLaunchMarketingPath(pathname)) {
    return { action: "rewrite", pathname: internalMarketingPath(pathname), site: "marketing" };
  }
  if (isLegacyMarketingPath(pathname)) {
    return { action: "pass", site: "marketing" };
  }
  if (pathname.startsWith("/marketing-internal")) {
    return { action: "reject", status: 404, site: "marketing" };
  }
  return { action: "redirect", location: `${appUrl(pathname)}${search}`, status: 307 };
}

function appDecision(pathname: string, search: string): HostRoutingDecision {
  if (pathname === "/robots.txt") return { action: "robots", site: "app" };
  if (pathname === "/sitemap.xml") return { action: "reject", status: 404, site: "app" };
  if (pathname.startsWith("/marketing-internal")) return { action: "reject", status: 404, site: "app" };
  if (pathname === "/") return { action: "redirect", location: `${marketingUrl(pathname)}${search}`, status: 307 };
  if (isSharedStatic(pathname) || APP_PWA_PATHS.has(pathname) || pathname.startsWith("/api/") || isAppPage(pathname)) {
    return { action: "pass", site: "app" };
  }
  // /capataz is both the public product page and the existing private assistant.
  // Preserve the authenticated product route on the application hostname.
  if (pathname === "/capataz") return { action: "pass", site: "app" };
  if (isLaunchMarketingPath(pathname) || isLegacyMarketingPath(pathname)) {
    return { action: "redirect", location: `${marketingUrl(pathname)}${search}`, status: 307 };
  }
  return { action: "pass", site: "app" };
}

function isLegacyMarketingPath(pathname: string) {
  return LEGACY_MARKETING_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAppPage(pathname: string) {
  return APP_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isSharedStatic(pathname: string) {
  return SHARED_STATIC_EXACT.has(pathname) || SHARED_STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function marketingUrl(pathname: string) {
  return `https://${MARKETING_HOST}${pathname}`;
}

function appUrl(pathname: string) {
  return `https://${APP_HOST}${pathname}`;
}

function normalizePathname(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function normalizeSearch(value?: string) {
  if (!value) return "";
  return value.startsWith("?") && !value.includes("#") ? value : "";
}
