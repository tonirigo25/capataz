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
check(css.includes(".v4-feature > div > * { min-width: 0; }"), "Las escenas deben poder encogerse sin recorte en móvil");
check(css.includes("@media (min-width: 1180px) { .brand-candidates__grid"), "La cuadrícula de marca no debe desbordar a 1024 px");
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

const publicHome = text("app/page.tsx");
const publicHeader = text("app/marketing-v2/_components/marketing-header.tsx");
const publicHero = text("app/marketing-v2/_components/hero-demo.tsx");
const publicLanding = text("app/marketing-v2/_components/landing-sections.tsx");
const publicStory = text("app/marketing-v2/_components/immersive-journey.tsx");
const publicCss = text("app/marketing-v2/page.module.css");
const guidedDemo = text("app/demo-v2/_components/guided-demo.tsx");
check(publicHome.includes("<HeroDemo />") && publicHome.includes("<LandingSections />"), "La home canónica debe componer hero y relato Field OS");
check(["Producto", "Soluciones", "Precios", "Recursos", "Empresa", "Iniciar sesión", "Solicitar demo"].every((label) => publicHeader.includes(label)), "El header D2 exacto está incompleto");
check(publicHero.includes("CAPATAZ · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS") && publicHero.includes("Gestiona tu empresa."), "El hero D2 no coincide con el contrato recibido");
check(publicHero.includes("Ver cómo funciona") && publicHero.includes("Solicitar demo"), "Faltan las dos CTA exactas del hero D2");
check(["Gestiona tu empresa.", "Ahorra tiempo.", "Toma el control.", "Todo conectado", "IA con control humano", "Datos aislados y seguros", "Acceso web y móvil"].every((label) => publicHero.includes(label)), "Hero y franja de valor D2 incompletos");
check((publicStory.match(/^\s{4}id: "/gmu) || []).length === 5, "La sticky story debe contener exactamente cinco etapas");
check(["Contacto y visita", "Presupuesto", "Trabajo y planificación", "Compras y costes", "Factura y cobro"].every((label) => publicStory.includes(label)), "La sticky story D2 no conserva el orden exacto");
check(["id=\"resultados\"", "id=\"para-quien\"", "id=\"captura-movil\"", "id=\"confianza\"", "id=\"preguntas\"", '<DemoRequestForm kind="home" />'].every((marker) => publicLanding.includes(marker)), "Resultados, responsabilidad, móvil, confianza, FAQ o formulario persistente ausentes");
check(guidedDemo.includes('id="quick-demo"') && guidedDemo.includes("no necesitas registrarte") && guidedDemo.includes("onKeyDown"), "La demo D2 debe ser pública, clara y operable con teclado");
check(guidedDemo.includes("Confirmar simulación") && guidedDemo.includes("Resultado simulado") && guidedDemo.includes("Solicitar una demo real"), "La demo D2 necesita confirmación, resultado y CTA real");
check(publicCss.includes(".heroValueBand") && publicCss.includes(".immersiveStoryIntro") && publicCss.includes("position: sticky"), "La composición responsive de D2 está incompleta");

const compositionManifest = text("lib/marketing/composition-manifest.ts");
check(existsSync(path.join(root, "lib/marketing/composition-manifest.ts")), "Falta el manifiesto de composiciones");
check(compositionManifest.includes("hasRepeatedComposition") && compositionManifest.includes("relationship-map") && compositionManifest.includes("device-duet"), "El manifiesto no evita repetición visual");
check(motion.includes("autoplay = false") && motion.includes("data-autoplay"), "El autoplay debe ser opt-in y auditable");
check(scenes.includes('title="Tu negocio se mueve como un solo sistema" stages={heroStages} autoplay'), "Hero Product Orchestra debe tener autoplay");
check(scenes.includes("<DemoController labels={labels} autoplay interval={3000}>"), "Workflow empresarial debe tener autoplay");
check(scenes.includes('stages={roleStages} accent="blue" autoplay'), "Portales por responsabilidad debe tener autoplay");
check(scenes.includes('stages={clientStages} autoplay'), "Cliente 360 debe tener autoplay");
check(scenes.includes('stages={workStages} accent="sand" composition="timeline"') && !scenes.includes('stages={workStages} accent="sand" autoplay'), "Trabajo 360 debe conservar interacción manual");

const moduleScenes = text("components/marketing/module-scenes.tsx");
const modulePage = text("app/producto/[modulo]/page.tsx");
check(catalog.includes('family: "relationship" | "operation" | "control"'), "Faltan las tres familias editoriales de módulos");
check((moduleScenes.match(/^\s{2}(?:clientes|trabajo|ventas|compras|finanzas|agenda|documentos|equipo|orqena|movil):/gm) || []).length === 10 && moduleScenes.includes("data-module-scene"), "Cada módulo necesita una escena propia");
check(modulePage.includes("module-journey") && modulePage.includes("item.workflow.map"), "Las páginas de módulo necesitan workflow");
check(modulePage.includes("module-faq") && modulePage.includes("item.faq.map"), "Las páginas de módulo necesitan FAQ específica");

const sectorScenes = text("components/marketing/sector-scenes.tsx");
check(sectorScenes.includes("SectorMiniScene") && text("app/sectores/page.tsx").includes("sector-mosaic"), "Sectores debe usar mini escenas en mosaico");
check(sectorScenes.includes("data-sector-scene") && text("app/sectores/[sector]/page.tsx").includes("SectorHeroScene"), "Cada sector necesita escena identificable");

const unitEconomics = text("lib/commercial/unit-economics.ts");
check(
  [
    "publicPricingRequested && publicPricingApproval && publicPricingCatalogVersion",
    "mappedPriceKeys.length > 0",
    "PUBLIC_PRICING_ENABLED = publicPricingPolicy.enabled",
  ].every((token) => unitEconomics.includes(token))
  && text("app/planes/page.tsx").includes("data-public-pricing"),
  "El precio público debe permanecer cerrado sin solicitud, aprobación, catálogo y mapeo completos",
);
check(["infrastructureBase", "costPerUser", "storageGb", "documents", "inputTokens", "outputTokens", "transcriptionMinutes", "supportHours", "targetMargin", "contingency", "overagePrice"].every((field) => unitEconomics.includes(field)), "El modelo de unit economics está incompleto");
check(text("app/(app)/plataforma/page.tsx").includes('actor.platformRole === "PLATFORM_OWNER" ? <UnitEconomicsCalculator'), "El calculador de costes debe ser exclusivo de PLATFORM_OWNER");
check(text("app/seguridad/page.tsx").includes("security-diagram") && text("app/seguridad/page.tsx").includes("security-mosaic"), "Seguridad debe usar diagrama y ejemplos visuales");
const demoStudio = text("components/marketing/demo-studio.tsx");
check(demoStudio.includes('id="demo-objective"') && demoStudio.includes("49 segundos") && demoStudio.includes("setPlaying"), "Demo debe incluir objetivo y recorrido manual de 45–90 segundos");
const routeAccess = text("lib/route-access.ts");
check(routeAccess.includes('pathname.startsWith("/brand/")') && routeAccess.includes("PROTECTED_PAGE_PREFIXES"), "Activos de marca y 404 deben evitar el redirect de autenticación");
check(text("app/not-found.tsx").includes("robots: { index: false, follow: false }"), "La 404 debe declarar noindex");
check(text("components/auth/login-form.tsx").includes("Solicitar acceso"), "El login beta debe ofrecer solicitar acceso");
check(text("app/(app)/clientes/[id]/page.tsx").includes("ClientRelationshipRail") && text("app/(app)/obras/[id]/page.tsx").includes("WorkLifecycleRail"), "Cliente 360 y Trabajo 360 necesitan rail contextual");

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
const marketingShell = text("components/marketing/marketing-shell.tsx");
check(marketingShell.includes('className="hidden items-center gap-1 xl:flex"') && marketingShell.includes('className="relative xl:hidden"'), "El header público debe conservar el menú compacto a 1024 px");

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
