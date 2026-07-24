import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function text(file) {
  return readFileSync(path.join(root, file), "utf8");
}

const brandAssets = [
  "public/brand/mark.svg",
  "public/brand/mark-mono.svg",
  "public/brand/mark-inverse.svg",
  "public/brand/app-icon.svg",
  "public/brand/favicon.svg",
  "public/brand/icon-192.png",
  "public/brand/icon-512.png",
  "public/brand/icon-maskable-512.png",
  "public/brand/apple-touch-icon.png",
];
for (const asset of brandAssets) check(existsSync(path.join(root, asset)), `Falta activo de marca: ${asset}`);

const brandComponent = text("components/brand/brand-mark.tsx");
const candidateGrid = text("components/brand/brand-candidate-grid.tsx");
check((candidateGrid.match(/id: "(?:relay|weave|bridge)"/g) || []).length === 3, "Deben existir exactamente tres candidatos de marca");
check(candidateGrid.includes("selected: true") && candidateGrid.includes("Relay"), "Relay debe documentarse como candidato seleccionado");
check(brandComponent.includes("viewBox=\"0 0 64 64\""), "El símbolo debe usar un viewBox consistente");
check(!brandComponent.includes("<text"), "El símbolo no puede incrustar el wordmark");

const layout = text("app/layout.tsx");
const themeProvider = text("components/theme/theme-provider.tsx");
const themeSwitcher = text("components/theme/theme-switcher.tsx");
check(layout.includes("themeBootScript") && layout.includes("suppressHydrationWarning"), "Falta arranque de tema previo a hidratación");
check(themeProvider.includes("prefers-color-scheme") && themeProvider.includes("localStorage") && themeProvider.includes("document.cookie"), "La preferencia debe persistir y respetar Sistema");
for (const label of ["Claro", "Oscuro", "Sistema"]) check(themeSwitcher.includes(`label: "${label}"`), `Falta opción de tema ${label}`);

const css = text("app/globals.css");
check(css.includes('[data-theme="dark"]'), "Faltan tokens de tema oscuro");
check(css.includes("@media (prefers-reduced-motion: reduce)"), "Falta cobertura reduced motion");
check(css.includes("@media (forced-colors: active)"), "Falta cobertura forced colors");
check(css.includes("@media print"), "Falta tema claro de impresión");
for (const token of ["--cap-bg", "--cap-surface", "--cap-text", "--cap-brand", "--cap-border", "--cap-success", "--cap-warning", "--cap-danger", "--cap-info"]) {
  check(css.includes(token), `Falta token semántico ${token}`);
}

const motion = text("components/marketing/motion-system.tsx");
for (const symbol of ["DemoController", "ProductScene", "SceneStage", "SceneProgress", "PlaybackControls", "ReducedMotionFallback", "useInViewportPlayback", "useDocumentVisibilityPause"]) {
  check(motion.includes(`function ${symbol}`) || motion.includes(`export function ${symbol}`), `Falta sistema de movimiento: ${symbol}`);
}
check(motion.includes("cycles.current >= 2"), "La reproducción automática debe limitarse a dos ciclos");
check(motion.includes("visibilitychange") && motion.includes("IntersectionObserver"), "La reproducción debe pausar fuera de viewport o con pestaña oculta");

const scenes = text("components/marketing/product-scenes.tsx");
for (const scene of ["HeroProductOrchestra", "RolePortalStudio", "Client360Demo", "Work360Demo", "OrqenaActionDemo", "MobileWorkDemo", "SalesQuoteStudioDemo", "TreasuryFlowDemo", "ContextualAgendaDemo"]) {
  check(scenes.includes(`function ${scene}`), `Falta escena ${scene}`);
}
check(scenes.includes("no llama a servicios externos"), "La demo de Orqena debe declarar su ejecución determinista");

const referenceManifest = text("lib/marketing/visual-reference-manifest.ts");
check((referenceManifest.match(/id: "0[1-9]"/g) || []).length === 9, "VisualReferenceManifest debe mapear nueve referencias");
for (const field of ["publicPages", "authenticatedPages", "components", "dynamicBehavior", "staticFallback", "restrictions"]) {
  check(referenceManifest.includes(`${field}:`), `VisualReferenceManifest no declara ${field}`);
}

const catalog = text("lib/marketing/catalog.ts");
check((catalog.match(/module\("/g) || []).length === 10, "marketingProductCatalog debe contener diez módulos");
for (const sector of ["general_services", "construction", "installations", "professional_services", "consulting", "agency", "repair_workshop", "healthcare", "education", "retail", "hospitality", "real_estate", "other"]) {
  check(catalog.includes(`${sector}:`), `Falta sector público ${sector}`);
}

for (const publicRoute of [
  "app/page.tsx",
  "app/producto/page.tsx",
  "app/producto/[modulo]/page.tsx",
  "app/sectores/page.tsx",
  "app/sectores/[sector]/page.tsx",
  "app/planes/page.tsx",
  "app/seguridad/page.tsx",
  "app/demo/page.tsx",
  "app/contacto/page.tsx",
]) {
  check(existsSync(path.join(root, publicRoute)), `Falta ruta pública ${publicRoute}`);
}

const visibleFiles = [
  "app/page.tsx",
  "components/marketing/marketing-shell.tsx",
  "components/app-chrome.tsx",
  "components/marketing/product-scenes.tsx",
  "app/producto/page.tsx",
  "app/demo/page.tsx",
];
for (const file of visibleFiles) {
  const content = text(file);
  check(!/>\s*Capataz\s*</i.test(content), `Referencia visible a la marca anterior en ${file}`);
}

check(text("components/workspaces.tsx").includes("function ListWorkspace"), "Falta ListWorkspace");
check(text("components/workspaces.tsx").includes("function RecordWorkspace"), "Falta RecordWorkspace");
check(text("components/workspaces.tsx").includes("function RecordPeek"), "Falta RecordPeek");
check(text("app/(app)/clientes/page.tsx").includes("<ListWorkspace"), "Clientes no consume ListWorkspace");
check(text("app/(app)/clientes/[id]/page.tsx").includes("<RecordWorkspace"), "Cliente 360 no consume RecordWorkspace");
check(text("app/(app)/obras/[id]/page.tsx").includes("<RecordWorkspace"), "Trabajo 360 no consume RecordWorkspace");

const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const routeValidation = spawnSync(process.execPath, [tsxCli, "scripts/validate-route-experience-manifest.ts"], {
  cwd: root,
  encoding: "utf8",
});
check(routeValidation.status === 0, `RouteExperienceManifest incompleto: ${routeValidation.error?.message || routeValidation.stderr || routeValidation.stdout}`);

if (failures.length) {
  console.error(`ORQENA EXPERIENCE V4: ${failures.length} fallos de ${checks} comprobaciones`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ORQENA EXPERIENCE V4: ${checks}/${checks} comprobaciones superadas`);
