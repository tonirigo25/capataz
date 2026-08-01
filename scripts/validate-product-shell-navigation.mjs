import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const chrome = read("components/app-chrome.tsx");
const navigation = read("lib/product-navigation.ts");
const shell = read("components/app-shell.tsx");
const styles = read("app/globals.css");
const middleware = read("middleware.ts");
const searchPage = read("app/(app)/buscar/page.tsx");
const searchLoading = read("app/(app)/buscar/loading.tsx");
const searchError = read("app/(app)/buscar/error.tsx");
const primitives = read("components/ui-primitives.tsx");
const workspaces = read("components/workspaces.tsx");

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);

const primaryOrder = [
  'label: "Hoy"',
  'label: "Dashboard"',
  'label: "Clientes"',
  'label: "Trabajos"',
  'label: "Presupuestos"',
  'label: "Dinero"'
];
const primaryIndexes = primaryOrder.map((token) => navigation.indexOf(token));
const navigationOnly = navigation.slice(navigation.indexOf("export const primaryNavigation"), navigation.indexOf("export const createActions"));
const createOnly = navigation.slice(navigation.indexOf("export const createActions"), navigation.indexOf("export const captureActions"));

check("sidebar usa el ancho canónico del portal de 239 px", chrome.includes("field-os-app-shell") && chrome.includes("field-os-sidebar") && styles.includes("--fos-layout-sidebar: 239px"));
check("navegación principal tiene seis destinos en orden", primaryIndexes.every((index) => index >= 0) && primaryIndexes.every((index, position) => position === 0 || index > primaryIndexes[position - 1]));
check("Agenda permanece disponible en navegación adaptativa", navigation.indexOf('label: "Agenda"') > navigation.indexOf('label: "Control"'));
check("menú móvil conserva tres grupos aprobados", ['label: "Compras"', 'label: "Control"', 'label: "Administración"'].every((token) => navigation.includes(token)));
check("sidebar escritorio elimina Más áreas", !chrome.includes('id="desktop-more-navigation"') && !chrome.includes('onOpenMore') && !chrome.includes('aria-controls="desktop-more-navigation"'));
check("sidebar despliega submódulos estables bajo su módulo principal", navigation.includes("export const productSubnavigation") && ["/oportunidades", "/seguimientos", "/tareas", "/actividad", "/proveedores", "/subcontratas", "/facturas-proveedor", "/facturas-subcontratas", "/gastos-materiales", "/recordatorios", "/equipos", "/automatizaciones", "/plan-y-uso", "/auditoria"].every((route) => navigation.includes(`href: "${route}"`)) && chrome.includes("<NavigationBranch") && chrome.includes("Submenús de ${item.label}"));
check("submenús respetan capacidades, contexto y semántica expandida", chrome.includes("capabilitySet.has(item.capability)") && chrome.includes("parentActive || childActive") && chrome.includes("children.length > 0") && chrome.includes('data-expanded={expanded ? "true" : "false"}') && chrome.includes("aria-expanded={expanded}") && chrome.includes("aria-controls={controls}"));
check("Actividad estricta sólo se ofrece cuando capacidades y scopes equivalen a la ruta", navigation.slice(navigation.indexOf('"/obras": ['), navigation.indexOf('"/dinero": [')).includes('href: "/actividad"') && ["reports.view", "clients.view", "work.view", "sales.budgets.view", "sales.invoices.view", "treasury.view", "purchase_cost.view", "agenda.view", "documents.view"].every((capability) => chrome.includes(`"${capability}"`)) && chrome.includes('scope.scope !== "COMPANY"') && chrome.includes('item.href !== "/actividad" || activityRouteAvailable'));
check("perfiles de compras sin Dinero conservan un acceso principal", chrome.includes('label: "Compras"') && chrome.includes("const [landing, ...purchaseChildren] = children"));
check("Más excluye rutas ocultas históricas", ["/tareas", "/seguimientos", "/automatizaciones", "/alertas", "/recomendaciones", "/inteligencia"].every((route) => !navigationOnly.includes(`href: "${route}"`)));
check("rutas centrales no están bloqueadas por middleware", !middleware.includes("modulo-no-disponible") && middleware.includes("isProtectedPage"));
check("contexto de ruta central cubre áreas, detalles, formularios, documentos y desconocidas", ["areaContexts", "detailContexts", 'kind: "form"', 'kind: "document"', 'kind: "unknown"'].every((token) => navigation.includes(token)));
check("shell no expone el modo test y limita el aviso al demo de plataforma", shell.includes('mode === "demo" && platformAccess') && !shell.includes('mode === "production" || !platformAccess'));
check("paneles cierran por Escape, exterior y destino", chrome.includes('event.key === "Escape"') && chrome.includes('document.addEventListener("pointerdown"') && chrome.includes("onNavigate={onClose}"));
check("paneles restauran foco y hojas bloquean scroll", chrome.includes("activeTriggerRef.current?.focus()") && chrome.includes('document.body.style.overflow = "hidden"'));
check("diálogos contienen el foco por teclado", chrome.includes('event.key !== "Tab"') && chrome.includes("getFocusable") && chrome.includes('role="dialog"'));
check("búsqueda usa activador central y compacto, atajo y ruta existentes", chrome.includes("field-os-global-search") && chrome.includes("field-os-search-trigger") && chrome.includes("event.ctrlKey || event.metaKey") && chrome.includes('action="/buscar"'));
check("búsqueda presenta filas y estados vacío, carga, error y resultados", searchPage.includes("InteractiveRow") && searchPage.includes("¿Qué necesitas encontrar?") && searchPage.includes("No hay resultados") && searchLoading.includes("LoadingState") && searchError.includes("ErrorState"));
check("Orqena usa la ruta visual canónica y conserva el alias técnico", chrome.includes('href="/orqena-ia"') && navigation.includes('{ href: "/capataz", label: brand.assistantName }'));
check("notificaciones limitan contador a 99+ sin danger", chrome.includes('count > 99 ? "99+"') && !chrome.includes("bg-danger"));
check("móvil se construye desde PortalManifest y mantiene Nuevo y Más", chrome.includes("portalManifest.mobileNavigation") && chrome.includes('aria-label="Crear o capturar"') && chrome.includes('aria-label="Más áreas"'));
check("móvil no duplica utilidades dentro de sus grupos", chrome.includes("mobileUtilityDestinations") && chrome.includes('["/notificaciones", "/configuracion"]') && chrome.includes("mobileGroups"));
check("móvil activa el padre de cada submódulo autorizado", chrome.includes("capabilities={capabilities}") && chrome.includes("productSubnavigation[item.href]") && chrome.includes("capabilitySet.has(child.capability)") && chrome.includes("isProductDestinationActive(pathname, child.href)"));
check("Dashboard está disponible desde navegación y búsqueda", chrome.includes('href="/dashboard"') && searchPage.includes('href="/dashboard"'));
check("Crear contiene exactamente seis acciones aprobadas", (createOnly.match(/description: "/g) ?? []).length === 6 && ["Presupuesto", "Cliente", "Trabajo", "Gasto", "Cobro", "Visita"].every((label) => createOnly.includes(`label: "${label}"`)));
check("Crear no incluye Capataz", !navigation.slice(navigation.indexOf("export const createActions"), navigation.indexOf("export type RouteContext")).includes("Capataz"));
check("bottom sheet usa filas, scroll interno y safe area", chrome.includes("shell-menu-row") && chrome.includes("max-h-[85dvh]") && chrome.includes("env(safe-area-inset-bottom)"));
check("destinos móviles tienen aria-current y targets de 44 px", chrome.includes('aria-current={active ? "page"') && styles.includes(".shell-bottom-item") && styles.includes("min-h-16"));
check("shell conserva salto y landmarks accesibles", chrome.includes("Saltar al contenido") && chrome.includes('aria-label="Navegación principal"') && chrome.includes('aria-label="Navegación móvil"'));
check("shell conserva un único main durante la hidratación", chrome.includes('<div id="main-content"') && workspaces.includes('<main className={clsx("screen list-workspace"') && workspaces.includes('<main className={clsx("screen record-workspace"') && primitives.includes('return <main className={clsx("product-page"') && !primitives.includes('return <div className={clsx("product-page"'));
check("patrón reusable de retorno a entidad disponible", primitives.includes("function ParentNavigation") && primitives.includes('aria-label="Contexto de la entidad"'));
check("contenido reserva espacio móvil y evita overflow global", styles.includes("padding-bottom: calc(6.5rem + env(safe-area-inset-bottom))") && styles.includes("overflow-x: hidden"));
check("reduced motion permanece respetado", styles.includes("prefers-reduced-motion: reduce"));

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[product-shell-navigation] OK", name);
  else {
    failed += 1;
    console.error("[product-shell-navigation] FAIL", name);
  }
}

if (failed) process.exit(1);
