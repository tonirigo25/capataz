import { brand } from "@/lib/brand";

export type RouteExperience = {
  family: "marketing" | "auth" | "onboarding" | "home" | "list" | "record" | "form" | "assistant" | "settings" | "platform" | "state";
  shell: "marketing" | "auth" | "app" | "standalone";
  access: "public" | "anonymous" | "membership" | "capability" | "platform";
  title: string;
  primaryAction: string;
  mobile: "responsive" | "native-list" | "record-page" | "sheet-form";
  loading: "route" | "skeleton" | "inline";
  empty: "guided" | "not-applicable";
  error: "recoverable" | "not-found" | "restricted";
  restricted: "redirect" | "inline-or-redirect" | "not-applicable";
  readOnly: "server-enforced" | "not-applicable";
  demo: "synthetic-safe" | "public-synthetic" | "not-applicable";
  archive: "available" | "route-dependent" | "not-applicable";
  destructiveConfirmation: "required" | "route-dependent" | "not-applicable";
  permissionScope: "public" | "anonymous" | "membership" | "capability-and-scope" | "platform-owner";
  screenshotGroup: "public" | "auth" | "shell" | "lists" | "records" | "control" | "states";
};

export type RouteExperienceRule = RouteExperience & {
  id: string;
  pattern: RegExp;
};

const rule = (
  id: string,
  pattern: RegExp,
  experience: RouteExperience,
): RouteExperienceRule => ({ id, pattern, ...experience });

const shared = {
  mobile: "responsive",
  loading: "route",
  error: "recoverable",
  restricted: "redirect",
  readOnly: "server-enforced",
  demo: "synthetic-safe",
  archive: "not-applicable",
  destructiveConfirmation: "not-applicable",
  permissionScope: "capability-and-scope",
} as const;

const publicShared = {
  ...shared,
  restricted: "not-applicable",
  readOnly: "not-applicable",
  demo: "not-applicable",
  permissionScope: "public",
} as const;

const anonymousShared = {
  ...shared,
  restricted: "not-applicable",
  readOnly: "not-applicable",
  demo: "not-applicable",
  permissionScope: "anonymous",
} as const;

const membershipShared = {
  ...shared,
  restricted: "inline-or-redirect",
  permissionScope: "membership",
} as const;

export const fieldOsShellContract = {
  desktop: {
    sidebarWidth: "var(--fos-layout-sidebar)",
    actions: ["Buscar", "Crear", brand.productName, "Notificaciones"],
  },
  mobile: {
    destinations: ["Hoy", "Clientes", "Capturar", "Trabajos", "Más"],
    capturePermissions: "on-selection",
  },
  states: ["loading", "empty", "error", "restricted"],
} as const;

export const routeExperienceManifest: RouteExperienceRule[] = [
  rule("public-home", /^\/$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: brand.productName, primaryAction: "Solicitar acceso", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-marketing-preview", /^\/marketing-v2$/, { ...publicShared, family: "marketing", shell: "standalone", access: "public", title: `${brand.productName} — Vista previa preservada`, primaryAction: "Ver la base visual", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-guided-demo-preview", /^\/demo-v2$/, { ...publicShared, family: "marketing", shell: "standalone", access: "public", title: `Prueba ${brand.productName} — Demostración guiada`, primaryAction: "Recorrer demostración", empty: "not-applicable", demo: "public-synthetic", screenshotGroup: "public" }),
  rule("public-product", /^\/(?:producto(?:\/\[modulo\])?|soluciones(?:\/\[solucion\])?)$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: "Producto", primaryAction: "Explorar demo", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-sectors", /^\/sectores(?:\/\[sector\])?$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: "Sectores", primaryAction: "Explorar perfil", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-demo", /^\/demo$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: "Demostración", primaryAction: "Confirmar simulación", empty: "not-applicable", demo: "public-synthetic", screenshotGroup: "public" }),
  rule("public-commercial", /^\/(?:planes|seguridad|contacto)$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: "Información comercial", primaryAction: "Solicitar acceso", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-legal-support", /^\/(?:privacidad|politicas|terminos|cookies|soporte|estado|recursos\/(?:calculadora-margen-obra|checklist-factura-recibida))$/, { ...publicShared, family: "marketing", shell: "marketing", access: "public", title: "Información", primaryAction: "Volver", empty: "not-applicable", screenshotGroup: "public" }),
  rule("auth", /^\/(?:login|registro|recuperar-contrasena|restablecer-contrasena|verificar-email|aceptar-invitacion)$/, { ...anonymousShared, family: "auth", shell: "auth", access: "anonymous", title: "Acceso", primaryAction: "Continuar", empty: "not-applicable", screenshotGroup: "auth" }),
  rule("access-state", /^\/(?:acceso-pendiente|acceso-restringido|modulo-no-disponible)$/, { ...anonymousShared, family: "state", shell: "standalone", access: "anonymous", title: "Estado de acceso", primaryAction: "Volver", empty: "guided", error: "restricted", screenshotGroup: "states" }),
  rule("onboarding", /^\/(?:onboarding|crear-empresa|seleccionar-empresa)$/, { ...membershipShared, family: "onboarding", shell: "app", access: "membership", title: "Preparar Orqena", primaryAction: "Continuar", mobile: "sheet-form", empty: "guided", screenshotGroup: "shell" }),
  rule("home", /^\/(?:hoy|dashboard|demo-guiada)$/, { ...membershipShared, family: "home", shell: "app", access: "membership", title: "Hoy", primaryAction: "Abrir prioridad", empty: "guided", screenshotGroup: "shell" }),
  rule("clients", /^\/clientes$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Clientes", primaryAction: "Añadir cliente", mobile: "native-list", empty: "guided", archive: "available", screenshotGroup: "lists" }),
  rule("client-record", /^\/clientes\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Cliente 360", primaryAction: "Siguiente acción", mobile: "record-page", empty: "guided", archive: "available", destructiveConfirmation: "required", screenshotGroup: "records" }),
  rule("work-list", /^\/obras$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Trabajos", primaryAction: "Nuevo trabajo", mobile: "native-list", empty: "guided", archive: "available", screenshotGroup: "lists" }),
  rule("work-record", /^\/obras\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Trabajo 360", primaryAction: "Registrar avance", mobile: "record-page", empty: "guided", archive: "available", destructiveConfirmation: "required", screenshotGroup: "records" }),
  rule("sales-lists", /^\/(?:presupuestos|dinero)(?:\/plantillas)?$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Ventas y facturas", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("sales-records", /^\/(?:presupuestos|dinero)\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Documento comercial", primaryAction: "Revisar estado", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("procurement-lists", /^\/(?:proveedores|subcontratas|facturas-proveedor|facturas-subcontratas|gastos-materiales)(?:\/lector)?$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Compras", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("procurement-records", /^\/(?:proveedores|subcontratas|facturas-proveedor|facturas-subcontratas)\/\[id\]$|^\/gastos-materiales\/lector\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Registro de compra", primaryAction: "Revisar", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("operational-lists", /^\/(?:agenda|actividad|alertas|automatizaciones|documentos|notificaciones|recordatorios)$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Operación", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("archivable-operational-lists", /^\/(?:seguimientos|tareas)$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Operación", primaryAction: "Crear", mobile: "native-list", empty: "guided", archive: "available", screenshotGroup: "lists" }),
  rule("operational-records", /^\/automatizaciones\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Detalle operativo", primaryAction: "Actualizar", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("archivable-operational-records", /^\/(?:seguimientos|tareas)\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Detalle operativo", primaryAction: "Actualizar", mobile: "record-page", empty: "guided", archive: "available", destructiveConfirmation: "required", screenshotGroup: "records" }),
  rule("assistant", /^\/capataz$/, { ...shared, family: "assistant", shell: "app", access: "capability", title: brand.productName, primaryAction: "Nueva conversación", empty: "guided", archive: "available", destructiveConfirmation: "required", screenshotGroup: "control" }),
  rule("forms", /^\/gestion$/, { ...shared, family: "form", shell: "app", access: "capability", title: "Editar", primaryAction: "Guardar", mobile: "sheet-form", empty: "not-applicable", screenshotGroup: "records" }),
  rule("control", /^\/(?:buscar|inteligencia|recomendaciones(?:\/control)?|tesoreria)$/, { ...shared, family: "home", shell: "app", access: "capability", title: "Control", primaryAction: "Revisar", empty: "guided", screenshotGroup: "control" }),
  rule("team", /^\/(?:equipo|equipos)(?:\/(?:\[membershipId\]\/portal|outbox))?$/, { ...shared, family: "settings", shell: "app", access: "capability", title: "Equipo", primaryAction: "Gestionar acceso", empty: "guided", destructiveConfirmation: "route-dependent", screenshotGroup: "control" }),
  rule("settings", /^\/(?:configuracion(?:\/(?:ia|importar|memoria|preferencias|privacidad|seguridad|soporte(?:\/ayuda)?))?|plan-y-uso)$/, { ...membershipShared, family: "settings", shell: "app", access: "membership", title: "Configuración", primaryAction: "Guardar", mobile: "sheet-form", empty: "not-applicable", screenshotGroup: "control" }),
  rule("audit", /^\/auditoria$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Auditoría", primaryAction: "Filtrar", mobile: "native-list", empty: "guided", screenshotGroup: "control" }),
  rule("platform", /^\/plataforma(?:\/(?:observabilidad|salud))?$/, { ...shared, family: "platform", shell: "app", access: "platform", title: "Plataforma interna", primaryAction: "Revisar", empty: "guided", permissionScope: "platform-owner", screenshotGroup: "control" }),
];

export function resolveRouteExperience(pathname: string): RouteExperienceRule | null {
  const matches = routeExperienceManifest.filter((item) => item.pattern.test(pathname));
  return matches.length === 1 ? matches[0] : null;
}

export function getRouteExperienceMatches(pathname: string) {
  return routeExperienceManifest.filter((item) => item.pattern.test(pathname));
}
