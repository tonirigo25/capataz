import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const chrome = read("components/app-chrome.tsx");
const today = read("app/(app)/hoy/page.tsx");
const styles = read("app/globals.css");
const primitives = read("components/ui-primitives.tsx");

const cases = [
  ["navegación principal de escritorio", ["Hoy", "Clientes", "Obras", "Presupuestos", "Facturas y cobros", "Agenda"].every((label) => chrome.includes(`label: "${label}"`))],
  ["navegación móvil prioriza Hoy, Obras, Crear, Agenda y Más", chrome.includes("Navegación móvil") && chrome.includes('aria-label="Crear"') && chrome.includes('aria-label="Más módulos"')],
  ["módulos secundarios permanecen accesibles", ["Proveedores", "Subcontratas", "Gastos y materiales", "Tareas", "Seguimientos", "Automatizaciones", "Inteligencia", "Alertas", "Configuración"].every((label) => chrome.includes(label))],
  ["buscador global visible en escritorio", chrome.includes("Buscar cliente, obra, factura...")],
  ["paneles móviles son diálogos y controlan foco", chrome.includes('role="dialog"') && chrome.includes('aria-modal="true"') && chrome.includes("closeButtonRef.current?.focus()") && chrome.includes("lastTriggerRef.current?.focus()")],
  ["shell incluye salto al contenido y destino principal", chrome.includes("Saltar al contenido") && chrome.includes('id="main-content"')],
  ["Hoy conserva la jerarquía funcional acordada", ["¿Qué ha pasado hoy?", "Necesita tu atención", "Estado del negocio", "Agenda de hoy", "Acciones rápidas", "Actividad reciente"].every((label) => today.includes(label))],
  ["Hoy usa como máximo seis métricas", (today.match(/<StatCard /g) ?? []).length === 6],
  ["entrada Capataz explica revisión y confirmación", today.includes("revisar la transcripción y confirmar antes de guardar")],
  ["tokens base consolidados", ["--cap-bg", "--cap-surface", "--cap-border", "--cap-brand-strong", "--cap-shadow-md", "--cap-content-max", "--cap-transition"].every((token) => styles.includes(token))],
  ["safe area y reserva móvil", styles.includes("env(safe-area-inset-bottom)") && chrome.includes("pb-[env(safe-area-inset-bottom)]")],
  ["movimiento reducido respetado", styles.includes("prefers-reduced-motion: reduce")],
  ["componentes compartidos ampliados sin librería paralela", ["PageContainer", "Section", "Card", "DataList", "MobileList", "ResponsiveTable", "Tabs", "SearchInput"].every((name) => primitives.includes(`function ${name}`))]
];

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[visual-foundations] OK", name);
  else {
    failed += 1;
    console.error("[visual-foundations] FAIL", name);
  }
}

if (failed) process.exit(1);
