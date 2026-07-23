export const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
  "/verificar-email",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/politicas",
  "/soporte",
  "/modulo-no-disponible"
]);

export const PUBLIC_RESOURCE_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/offline.html",
  "/robots.txt",
  "/sitemap.xml"
]);

export const PUBLIC_API_PREFIXES = ["/api/status"];
export const INTERNAL_API_PREFIXES = ["/api/internal"];

export function pathMatches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isPublicPage(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname);
}

export function isPublicResource(pathname: string) {
  return PUBLIC_RESOURCE_PATHS.has(pathname)
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/icons/");
}

export function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((path) => pathname === path);
}

export function isInternalApi(pathname: string) {
  return INTERNAL_API_PREFIXES.some((path) => pathMatches(pathname, path));
}

export function isProtectedPage(pathname: string) {
  return !pathname.startsWith("/api/") && !isPublicPage(pathname) && !isPublicResource(pathname);
}

export function safeReturnPath(pathname: string, search: string) {
  const value = `${pathname}${search}`;
  return value.startsWith("/") && !value.startsWith("//") ? value : "/hoy";
}
