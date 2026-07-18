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

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);

const primaryOrder = [
  'label: "Hoy"',
  'label: "Clientes"',
  'label: "Obras"',
  'label: "Agenda"',
  'label: "Presupuestos"',
  'label: "Facturas y cobros"'
];
const primaryIndexes = primaryOrder.map((token) => navigation.indexOf(token));

check("sidebar conserva ancho de 240 px", chrome.includes("lg:pl-60") && chrome.includes("w-60"));
check("navegación principal tiene seis destinos en orden", primaryIndexes.every((index) => index >= 0) && primaryIndexes.every((index, position) => position === 0 || index > primaryIndexes[position - 1]));
check("Más usa tres grupos aprobados", ['label: "Compras"', 'label: "Control"', 'label: "Administración"'].every((token) => navigation.includes(token)));
check("Más excluye rutas ocultas históricas", ["/tareas", "/seguimientos", "/automatizaciones", "/alertas", "/recomendaciones", "/inteligencia"].every((route) => !navigation.includes(`href: "${route}"`)));
check("rutas centrales no están bloqueadas por middleware", !middleware.includes("modulo-no-disponible") && middleware.includes("isProtectedPage"));
check("contexto de ruta central cubre áreas, detalles, formularios, documentos y desconocidas", ["areaContexts", "detailContexts", 'kind: "form"', 'kind: "document"', 'kind: "unknown"'].every((token) => navigation.includes(token)));
check("shell no muestra entorno en producción", shell.includes('mode === "production" ? undefined'));
check("panel Más cierra por Escape, exterior, destino y botón", chrome.includes('event.key === "Escape"') && chrome.includes('document.addEventListener("pointerdown"') && chrome.includes("onNavigate={onClose}") && chrome.includes('aria-label="Cerrar Más"'));
check("paneles restauran foco y hojas bloquean scroll", chrome.includes("activeTriggerRef.current?.focus()") && chrome.includes('document.body.style.overflow = "hidden"'));
check("diálogos contienen el foco por teclado", chrome.includes('event.key !== "Tab"') && chrome.includes("getFocusable") && chrome.includes('role="dialog"'));
check("búsqueda usa activador, atajo y ruta existentes", chrome.includes("Buscar en Capataz") && chrome.includes("event.ctrlKey || event.metaKey") && chrome.includes('action="/buscar"'));
check("búsqueda presenta filas y estados vacío, carga, error y resultados", searchPage.includes("InteractiveRow") && searchPage.includes("¿Qué necesitas encontrar?") && searchPage.includes("No hay resultados") && searchLoading.includes("LoadingState") && searchError.includes("ErrorState"));
check("Capataz es una acción secundaria estable", chrome.includes('href="/capataz"') && chrome.includes(">Capataz"));
check("notificaciones limitan contador a 99+ sin danger", chrome.includes('count > 99 ? "99+"') && !chrome.includes("bg-danger"));
check("móvil mantiene Hoy, Clientes, Crear, Obras y Más", chrome.includes("primaryNavigation[0]") && chrome.includes("primaryNavigation[1]") && chrome.includes("primaryNavigation[2]") && chrome.includes('aria-label="Crear"') && chrome.includes('aria-label="Más áreas"'));
check("Crear contiene exactamente seis acciones aprobadas", (navigation.match(/description: "/g) ?? []).length === 6 && ["Presupuesto", "Cliente", "Obra", "Gasto", "Cobro", "Visita"].every((label) => navigation.includes(`label: "${label}"`)));
check("Crear no incluye Capataz", !navigation.slice(navigation.indexOf("export const createActions"), navigation.indexOf("export type RouteContext")).includes("Capataz"));
check("bottom sheet usa filas, scroll interno y safe area", chrome.includes("shell-menu-row") && chrome.includes("max-h-[85dvh]") && chrome.includes("env(safe-area-inset-bottom)"));
check("destinos móviles tienen aria-current y targets de 44 px", chrome.includes('aria-current={active ? "page"') && styles.includes(".shell-bottom-item") && styles.includes("min-h-16"));
check("shell conserva salto y landmarks accesibles", chrome.includes("Saltar al contenido") && chrome.includes('aria-label="Navegación principal"') && chrome.includes('aria-label="Navegación móvil"'));
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
