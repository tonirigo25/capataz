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
  "/modulo-no-disponible",
  "/demo",
  "/contacto",
  "/producto",
  "/sectores",
  "/planes",
  "/seguridad",
  "/soluciones",
  "/aceptar-invitacion"
]);

export const PUBLIC_RESOURCE_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/offline.html",
  "/robots.txt",
  "/sitemap.xml"
]);

export const PUBLIC_API_PREFIXES = ["/api/status", "/api/health/live", "/api/health/ready", "/api/security/csp-report"];
export const INTERNAL_API_PREFIXES = ["/api/internal"];
export const PROTECTED_PAGE_PREFIXES = [
  "/acceso-pendiente", "/acceso-restringido", "/actividad", "/agenda", "/alertas", "/auditoria",
  "/automatizaciones", "/buscar", "/capataz", "/clientes", "/configuracion", "/crear-empresa",
  "/dashboard", "/demo-guiada", "/dinero", "/documentos", "/equipo", "/equipos", "/facturas-proveedor",
  "/facturas-subcontratas", "/gastos-materiales", "/gestion", "/hoy", "/inteligencia", "/notificaciones",
  "/obras", "/onboarding", "/plan-y-uso", "/plataforma", "/presupuestos", "/proveedores",
  "/recomendaciones", "/recordatorios", "/seguimientos", "/seleccionar-empresa", "/subcontratas",
  "/tareas", "/tesoreria",
] as const;

export function pathMatches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isPublicPage(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname)
    || pathname.startsWith("/sectores/")
    || pathname.startsWith("/producto/");
}

export function isPublicResource(pathname: string) {
  return PUBLIC_RESOURCE_PATHS.has(pathname)
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/icons/")
    || pathname.startsWith("/marketing/")
    || pathname.startsWith("/media/marketing/")
    || pathname.startsWith("/brand/");
}

export function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((path) => pathname === path);
}

export function isInternalApi(pathname: string) {
  return INTERNAL_API_PREFIXES.some((path) => pathMatches(pathname, path));
}

export function isProtectedPage(pathname: string) {
  return !pathname.startsWith("/api/") && PROTECTED_PAGE_PREFIXES.some((path) => pathMatches(pathname, path));
}

export function safeReturnPath(pathname: string, search: string) {
  const value = `${pathname}${search}`;
  return value.startsWith("/") && !value.startsWith("//") ? value : "/hoy";
}
