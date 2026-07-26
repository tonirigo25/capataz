import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const chrome = read("components/app-chrome.tsx");
const today = read("app/(app)/hoy/page.tsx");
const todayWorkflow = read("components/today-workflow-summary.tsx");
const styles = read("app/globals.css");
const tailwind = read("tailwind.config.ts");
const primitives = read("components/ui-primitives.tsx");
const status = read("lib/status.ts");
const manual = read("docs/CAPATAZ_PRODUCT_DESIGN_MANUAL.md");
const roadmap = read("docs/CAPATAZ_MASTER_ROADMAP.md");

const exactTokens = [
  "--fos-color-ink: #111a16",
  "--fos-color-ink-muted: #66736c",
  "--fos-color-stone: #f3f0e7",
  "--fos-color-paper: #fbfaf7",
  "--fos-color-surface: #ffffff",
  "--fos-color-line: #d8ded7",
  "--fos-color-lime: #c9f36b",
  "--fos-color-blue: #2d5de0",
  "--fos-color-orange: #e96b3d",
  "--fos-color-red: #c8453b",
  "--fos-color-green: #157b59"
];

const primitiveNames = [
  "ProductPage",
  "PageHeader",
  "EntityHeader",
  "AnalyticsHeader",
  "Section",
  "Surface",
  "Button",
  "IconButton",
  "ActionMenu",
  "TextField",
  "MoneyField",
  "SelectField",
  "TextareaField",
  "FieldGroup",
  "FormSection",
  "StickyFormActions",
  "Tabs",
  "Status",
  "Notice",
  "EmptyState",
  "Skeleton",
  "Metric",
  "MetricGroup",
  "InteractiveRow",
  "TimelineItem"
];

const cases = [
  ["manual maestro incorporado y referenciado", manual.includes("# CAPATAZ — MANUAL MAESTRO DE DISEÑO DE PRODUCTO 2026") && roadmap.includes("CAPATAZ_PRODUCT_DESIGN_MANUAL.md")],
  ["tokens cromáticos Field OS coinciden con el contrato recibido", exactTokens.every((token) => styles.includes(token))],
  ["tokens de radio, ancho, control y movimiento disponibles", ["--cap-radius-control", "--cap-radius-object", "--cap-radius-feature", "--cap-radius-overlay", "--cap-content-max", "--cap-reading-max", "--cap-form-max", "--cap-control-field", "--cap-motion-control", "--cap-motion-menu", "--cap-motion-panel"].every((token) => styles.includes(token))],
  ["aliases obra quedan marcados como compatibilidad transitoria", tailwind.includes("Compatibilidad transitoria") && tailwind.includes("obra:")],
  ["tipografía normalizada y números tabulares", ["type-page-title", "type-section-title", "type-object-title", "type-body", "type-meta", "type-amount-primary", "font-variant-numeric: tabular-nums"].every((token) => styles.includes(token))],
  ["layouts operativos, analíticos, entidad, formulario y lectura", ["operational", "analytical", "entity", "form", "list", "reading"].every((layout) => primitives.includes(layout))],
  ["responsabilidades de primitivas cubiertas", primitiveNames.every((name) => primitives.includes(`function ${name}`))],
  ["campos mantienen etiqueta, ayuda, error y estado accesible", primitives.includes("FieldFrame") && primitives.includes("aria-describedby") && primitives.includes("aria-invalid")],
  ["botones cubren variantes y carga", ["primary", "secondary", "ghost", "danger", "row", "aria-busy", "loadingLabel"].every((token) => primitives.includes(token))],
  ["navegación secundaria usa URL y overflow accesible", primitives.includes("<nav aria-label={label}") && primitives.includes("overflow-x-auto") && primitives.includes("aria-current=page")],
  ["estados semánticos no dependen de color heredado", ["active", "completed", "attention", "risk", "archived"].every((tone) => primitives.includes(tone)) && status.includes("bg-content/[0.08]")],
  ["shell usa sidebar de 240 px y objetivos táctiles", chrome.includes("lg:pl-60") && chrome.includes("w-60") && styles.includes("--cap-control: 2.75rem")],
  ["shell conserva salto, diálogo, Escape y restauración de foco", chrome.includes("Saltar al contenido") && chrome.includes('role="dialog"') && chrome.includes('event.key === "Escape"') && chrome.includes("activeTriggerRef.current?.focus()")],
  ["Hoy muestra una acción primaria contextual", today.includes("Hablar con Orqena") && !today.includes("¿Qué ha pasado hoy?")],
  ["Hoy limita la primera zona a tres señales", today.includes("portal.homeWidgets.slice(0, 3).map") && today.includes("Tus prioridades")],
  ["Hoy deriva consultas desde contexto autorizado", today.includes('requireCapability("company.view")') && today.includes("buildPortalManifest(auth)") && today.includes("getAgendaItems()")],
  ["foco, safe area y movimiento reducido", styles.includes(":focus-visible") && styles.includes("env(safe-area-inset-bottom)") && styles.includes("prefers-reduced-motion: reduce")],
  ["campos evitan zoom involuntario en iOS", styles.includes("font-size: 16px") && styles.includes("--cap-control-field: 3rem")]
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
