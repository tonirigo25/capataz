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
} as const;

export const routeExperienceManifest: RouteExperienceRule[] = [
  rule("public-home", /^\/$/, { ...shared, family: "marketing", shell: "marketing", access: "public", title: "Orqena", primaryAction: "Solicitar acceso", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-capataz-preview", /^\/marketing-v2$/, { ...shared, family: "marketing", shell: "standalone", access: "public", title: "Capataz — Vista previa", primaryAction: "Ver la base visual", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-product", /^\/(?:producto(?:\/\[modulo\])?|soluciones)$/, { ...shared, family: "marketing", shell: "marketing", access: "public", title: "Producto", primaryAction: "Explorar demo", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-sectors", /^\/sectores(?:\/\[sector\])?$/, { ...shared, family: "marketing", shell: "marketing", access: "public", title: "Sectores", primaryAction: "Explorar perfil", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-commercial", /^\/(?:planes|seguridad|demo|contacto)$/, { ...shared, family: "marketing", shell: "marketing", access: "public", title: "Información comercial", primaryAction: "Solicitar acceso", empty: "not-applicable", screenshotGroup: "public" }),
  rule("public-legal-support", /^\/(?:privacidad|politicas|terminos|cookies|soporte)$/, { ...shared, family: "marketing", shell: "marketing", access: "public", title: "Información", primaryAction: "Volver", empty: "not-applicable", screenshotGroup: "public" }),
  rule("auth", /^\/(?:login|registro|recuperar-contrasena|restablecer-contrasena|verificar-email|aceptar-invitacion)$/, { ...shared, family: "auth", shell: "auth", access: "anonymous", title: "Acceso", primaryAction: "Continuar", empty: "not-applicable", screenshotGroup: "auth" }),
  rule("access-state", /^\/(?:acceso-pendiente|acceso-restringido|modulo-no-disponible)$/, { ...shared, family: "state", shell: "standalone", access: "anonymous", title: "Estado de acceso", primaryAction: "Volver", empty: "guided", error: "restricted", screenshotGroup: "states" }),
  rule("onboarding", /^\/(?:onboarding|crear-empresa|seleccionar-empresa)$/, { ...shared, family: "onboarding", shell: "app", access: "membership", title: "Preparar Orqena", primaryAction: "Continuar", mobile: "sheet-form", empty: "guided", screenshotGroup: "shell" }),
  rule("home", /^\/(?:hoy|dashboard|demo-guiada)$/, { ...shared, family: "home", shell: "app", access: "membership", title: "Hoy", primaryAction: "Abrir prioridad", empty: "guided", screenshotGroup: "shell" }),
  rule("clients", /^\/clientes$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Clientes", primaryAction: "Añadir cliente", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("client-record", /^\/clientes\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Cliente 360", primaryAction: "Siguiente acción", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("work-list", /^\/obras$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Trabajos", primaryAction: "Nuevo trabajo", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("work-record", /^\/obras\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Trabajo 360", primaryAction: "Registrar avance", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("sales-lists", /^\/(?:presupuestos|dinero)(?:\/plantillas)?$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Ventas y facturas", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("sales-records", /^\/(?:presupuestos|dinero)\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Documento comercial", primaryAction: "Revisar estado", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("procurement-lists", /^\/(?:proveedores|subcontratas|facturas-proveedor|facturas-subcontratas|gastos-materiales)(?:\/lector)?$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Compras", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("procurement-records", /^\/(?:proveedores|subcontratas|facturas-proveedor|facturas-subcontratas)\/\[id\]$|^\/gastos-materiales\/lector\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Registro de compra", primaryAction: "Revisar", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("operational-lists", /^\/(?:agenda|actividad|alertas|automatizaciones|documentos|notificaciones|recordatorios|seguimientos|tareas)$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Operación", primaryAction: "Crear", mobile: "native-list", empty: "guided", screenshotGroup: "lists" }),
  rule("operational-records", /^\/(?:automatizaciones|seguimientos|tareas)\/\[id\]$/, { ...shared, family: "record", shell: "app", access: "capability", title: "Detalle operativo", primaryAction: "Actualizar", mobile: "record-page", empty: "guided", screenshotGroup: "records" }),
  rule("assistant", /^\/capataz$/, { ...shared, family: "assistant", shell: "app", access: "capability", title: "Orqena", primaryAction: "Nueva conversación", empty: "guided", screenshotGroup: "control" }),
  rule("forms", /^\/gestion$/, { ...shared, family: "form", shell: "app", access: "capability", title: "Editar", primaryAction: "Guardar", mobile: "sheet-form", empty: "not-applicable", screenshotGroup: "records" }),
  rule("control", /^\/(?:buscar|inteligencia|recomendaciones(?:\/control)?|tesoreria)$/, { ...shared, family: "home", shell: "app", access: "capability", title: "Control", primaryAction: "Revisar", empty: "guided", screenshotGroup: "control" }),
  rule("team", /^\/(?:equipo|equipos)(?:\/(?:\[membershipId\]\/portal|outbox))?$/, { ...shared, family: "settings", shell: "app", access: "capability", title: "Equipo", primaryAction: "Gestionar acceso", empty: "guided", screenshotGroup: "control" }),
  rule("settings", /^\/(?:configuracion(?:\/memoria)?|plan-y-uso)$/, { ...shared, family: "settings", shell: "app", access: "membership", title: "Configuración", primaryAction: "Guardar", mobile: "sheet-form", empty: "not-applicable", screenshotGroup: "control" }),
  rule("audit", /^\/auditoria$/, { ...shared, family: "list", shell: "app", access: "capability", title: "Auditoría", primaryAction: "Filtrar", mobile: "native-list", empty: "guided", screenshotGroup: "control" }),
  rule("platform", /^\/plataforma$/, { ...shared, family: "platform", shell: "app", access: "platform", title: "Plataforma interna", primaryAction: "Revisar", empty: "guided", screenshotGroup: "control" }),
];

export function resolveRouteExperience(pathname: string): RouteExperienceRule | null {
  const matches = routeExperienceManifest.filter((item) => item.pattern.test(pathname));
  return matches.length === 1 ? matches[0] : null;
}

export function getRouteExperienceMatches(pathname: string) {
  return routeExperienceManifest.filter((item) => item.pattern.test(pathname));
}
