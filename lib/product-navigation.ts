export type ProductIcon =
  | "activity"
  | "agenda"
  | "bot"
  | "briefcase"
  | "building"
  | "client"
  | "dashboard"
  | "document"
  | "expense"
  | "home"
  | "invoice"
  | "landmark"
  | "notification"
  | "receipt"
  | "settings";

export type ProductDestination = {
  href: string;
  label: string;
  icon: ProductIcon;
  capability?: string;
};

export type ProductNavigationGroup = {
  label: string;
  items: ProductDestination[];
};

export const primaryNavigation: ProductDestination[] = [
  { href: "/hoy", label: "Hoy", icon: "home" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", capability: "company.view" },
  { href: "/clientes", label: "Clientes", icon: "client", capability: "clients.view" },
  { href: "/obras", label: "Trabajos", icon: "briefcase", capability: "work.view" },
  { href: "/presupuestos", label: "Presupuestos", icon: "document", capability: "sales.budgets.view" },
  { href: "/dinero", label: "Facturas y cobros", icon: "invoice", capability: "sales.invoices.view" }
];

export const secondaryNavigation: ProductNavigationGroup[] = [
  {
    label: "Compras",
    items: [
      { href: "/proveedores", label: "Proveedores", icon: "client", capability: "purchases.suppliers.view" },
      { href: "/subcontratas", label: "Subcontratas", icon: "building", capability: "purchases.suppliers.view" },
      { href: "/facturas-proveedor", label: "Facturas proveedor", icon: "receipt", capability: "purchases.received_invoices.view" },
      { href: "/facturas-subcontratas", label: "Facturas subcontrata", icon: "receipt", capability: "purchases.received_invoices.view" },
      { href: "/gastos-materiales", label: "Gastos y materiales", icon: "expense", capability: "purchases.received_invoices.view" }
    ]
  },
  {
    label: "Control",
    items: [
      { href: "/agenda", label: "Agenda", icon: "agenda", capability: "agenda.view" },
      { href: "/tesoreria", label: "Tesorería", icon: "landmark", capability: "treasury.view" },
      { href: "/documentos", label: "Documentos", icon: "document", capability: "documents.view" },
      { href: "/recordatorios", label: "Recordatorios", icon: "agenda" },
      { href: "/actividad", label: "Actividad", icon: "activity" },
      { href: "/notificaciones", label: "Notificaciones", icon: "notification" }
    ]
  },
  {
    label: "Administración",
    items: [
      { href: "/equipo", label: "Roles y acceso", icon: "client", capability: "company.members.view" },
      { href: "/equipos", label: "Equipos", icon: "building" },
      { href: "/plan-y-uso", label: "Plan y uso", icon: "invoice", capability: "company.billing.manage" },
      { href: "/auditoria", label: "Auditoría", icon: "activity" },
      { href: "/configuracion", label: "Configuración", icon: "settings" }
    ]
  }
];

export const createActions: Array<ProductDestination & { description: string }> = [
  { href: "/gestion?tipo=presupuesto&returnTo=/hoy", label: "Presupuesto", description: "Preparar una propuesta", icon: "document", capability:"sales.budgets.create" },
  { href: "/gestion?tipo=cliente&returnTo=/clientes", label: "Cliente", description: "Añadir una relación", icon: "client", capability:"clients.create" },
  { href: "/gestion?tipo=obra&returnTo=/obras", label: "Trabajo", description: "Abrir un nuevo trabajo", icon: "briefcase", capability:"work.create" },
  { href: "/gestion?tipo=gasto&returnTo=/gastos-materiales", label: "Gasto", description: "Registrar una compra", icon: "expense", capability:"purchases.received_invoices.manage" },
  { href: "/gestion?tipo=pago&returnTo=/dinero", label: "Cobro", description: "Anotar un ingreso", icon: "invoice", capability:"treasury.collections.register" },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/agenda", label: "Visita", description: "Programar una cita", icon: "agenda", capability:"agenda.manage" }
];

export type RouteContext = {
  label: string;
  parentHref?: string;
  parentLabel?: string;
  kind: "area" | "detail" | "form" | "document" | "unknown";
};

const areaContexts = [
  ...primaryNavigation,
  ...secondaryNavigation.flatMap((group) => group.items),
  { href: "/buscar", label: "Búsqueda" },
  { href: "/capataz", label: "Orqena" },
  { href: "/equipo", label: "Equipo" },
  { href: "/equipos", label: "Equipos" },
  { href: "/plan-y-uso", label: "Plan y uso" },
  { href: "/auditoria", label: "Auditoría" },
  { href: "/plataforma", label: "Plataforma" }
];

const detailContexts: Array<{ pattern: RegExp; context: RouteContext }> = [
  { pattern: /^\/clientes\/[^/]+/, context: { label: "Cliente", parentHref: "/clientes", parentLabel: "Clientes", kind: "detail" } },
  { pattern: /^\/obras\/[^/]+/, context: { label: "Obra", parentHref: "/obras", parentLabel: "Obras", kind: "detail" } },
  { pattern: /^\/presupuestos\/[^/]+/, context: { label: "Presupuesto", parentHref: "/presupuestos", parentLabel: "Presupuestos", kind: "detail" } },
  { pattern: /^\/dinero\/[^/]+/, context: { label: "Factura", parentHref: "/dinero", parentLabel: "Facturas y cobros", kind: "detail" } },
  { pattern: /^\/proveedores\/[^/]+/, context: { label: "Proveedor", parentHref: "/proveedores", parentLabel: "Proveedores", kind: "detail" } },
  { pattern: /^\/subcontratas\/[^/]+/, context: { label: "Subcontrata", parentHref: "/subcontratas", parentLabel: "Subcontratas", kind: "detail" } },
  { pattern: /^\/facturas-proveedor\/[^/]+/, context: { label: "Factura proveedor", parentHref: "/facturas-proveedor", parentLabel: "Facturas proveedor", kind: "detail" } },
  { pattern: /^\/facturas-subcontratas\/[^/]+/, context: { label: "Factura subcontrata", parentHref: "/facturas-subcontratas", parentLabel: "Facturas subcontrata", kind: "detail" } },
  { pattern: /^\/documentos(?:\/|$)/, context: { label: "Documentos", parentHref: "/documentos", parentLabel: "Documentos", kind: "document" } }
];

export function resolveRouteContext(pathname: string): RouteContext {
  if (pathname === "/gestion" || pathname.startsWith("/gestion/")) {
    return { label: "Crear", kind: "form" };
  }

  const detail = detailContexts.find(({ pattern }) => pattern.test(pathname));
  if (detail) return detail.context;

  const area = [...areaContexts]
    .sort((a, b) => b.href.length - a.href.length)
    .find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  return area ? { label: area.label, kind: "area" } : { label: "Orqena", kind: "unknown" };
}

export function isProductDestinationActive(pathname: string, href: string) {
  const [base] = href.split(/[?#]/);
  return pathname === base || (base !== "/hoy" && pathname.startsWith(`${base}/`));
}
