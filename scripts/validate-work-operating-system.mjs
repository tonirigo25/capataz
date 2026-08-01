import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const readIfPresent = (path) => (fs.existsSync(path) ? read(path) : "");

const works = read("app/(app)/obras/page.tsx");
const work = read("app/(app)/obras/[id]/page.tsx");
const portfolio = read("components/portal/modules-a/work-portfolio.tsx");
const optionalDrawer = readIfPresent("components/portal/modules-a/work-detail-drawer.tsx");
const contextDrawer = read("components/context-drawer.tsx");
const chrome = read("components/app-chrome.tsx");
const rail = read("components/portal/orqena-context-rail.tsx");
const styles = read("app/globals.css");

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);
const count = (source, pattern) => (source.match(pattern) ?? []).length;

function mediaBlocksAt(source, width) {
  const blocks = [];
  const pattern = new RegExp(`@media\\s*\\(\\s*min-width\\s*:\\s*${width}px\\s*\\)\\s*\\{`, "g");
  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push(source.slice(match.index, index));
  }
  return blocks.join("\n");
}

const portfolioIndex = works.indexOf("<WorkPortfolio");
const beforePortfolio = portfolioIndex >= 0 ? works.slice(0, portfolioIndex) : works;
const desktop1440 = mediaBlocksAt(styles, 1440);
const drawerSource = `${portfolio}\n${optionalDrawer}`;

check(
  "Trabajo usa el título singular canónico",
  works.includes('title="Trabajo"') || /<h1[^>]*>\s*Trabajo\s*<\/h1>/.test(works),
);
check(
  "el listado no queda precedido por seis KPI ejecutivos",
  portfolioIndex >= 0 && count(beforePortfolio, /<ExecutiveMetric\b/g) < 6 && !beforePortfolio.includes("grid-cols-6"),
);

check(
  "Trabajo conserva las tres zonas: navegación, listado con detalle y rail IA",
  chrome.includes("field-os-sidebar") &&
    chrome.includes("field-os-main-canvas") &&
    chrome.includes("<OrqenaContextRail") &&
    portfolio.includes('aria-label="Trabajos filtrados"') &&
    /<aside[\s\S]{0,300}aria-label=/.test(portfolio) &&
    rail.includes('path === "/obras" || path.startsWith("/obras/")') &&
    rail.includes('area: "work"'),
);

const inline1440Detail =
  /min-\[1440px\]:(?:grid|block|flex)/.test(portfolio) &&
  /min-\[1440px\]:(?:hidden|grid|block|flex)/.test(portfolio);
const css1440Detail =
  /(?:\.works?-|\[data-work-(?:operating-system|detail|workspace|portfolio))/.test(desktop1440) &&
  /(?:grid-template-columns|display:\s*(?:grid|block|flex))/.test(desktop1440);
check(
  "el detalle persistente de escritorio empieza exactamente desde 1440px",
  (inline1440Detail || css1440Detail) && !portfolio.includes("2xl:block") && !portfolio.includes("2xl:grid"),
);

check(
  "la selección funciona por click y teclado y nunca por hover",
  portfolio.includes("onClick=") &&
    (portfolio.includes("<button") || portfolio.includes("onKeyDown=") || portfolio.includes("onFocusCapture=")) &&
    !portfolio.includes("onMouseEnter=") &&
    !portfolio.includes("onMouseOver="),
);

const usesSharedDrawer = portfolio.includes("ContextDrawer") && contextDrawer.includes("export function ContextDrawer");
const ownsAccessibleDrawer =
  /role="dialog"/.test(drawerSource) &&
  /aria-modal="true"/.test(drawerSource) &&
  /(?:data-work-mobile-drawer|work-detail-drawer|drawerOpen)/.test(drawerSource) &&
  /fixed inset-0/.test(drawerSource);
check(
  "móvil abre el detalle en un drawer accesible en lugar de expandir la fila",
  (usesSharedDrawer || ownsAccessibleDrawer) &&
    !portfolio.includes("2xl:hidden\"><WorkDetail"),
);

const accessibleDrawerSource = usesSharedDrawer ? contextDrawer : drawerSource;
check(
  "el drawer ofrece X, Escape y restauración de foco",
  accessibleDrawerSource.includes("<X") &&
    accessibleDrawerSource.includes('event.key === "Escape"') &&
    /(?:opener|trigger|previousFocus|lastTriggerRef)[\s\S]{0,260}\.focus\(\)/.test(accessibleDrawerSource),
);

const desktopRailHasOwnScroll =
  /\.orqena-context-rail(?:\s|>|\[|\.|:)*[^{}]*\{[^{}]*overflow-y\s*:\s*(?:auto|scroll)/.test(desktop1440) ||
  /className="[^"]*orqena-context-(?:rail|rail__inner)[^"]*overflow-y-(?:auto|scroll)/.test(rail);
check(
  "el rail IA de escritorio acompaña la página sin scroll vertical propio",
  desktop1440.includes(".orqena-context-rail") &&
    desktop1440.includes("overflow: visible") &&
    !desktopRailHasOwnScroll,
);

check(
  "la visibilidad económica llega explícitamente al portfolio mediante props",
  /budget:\s*item\.visibility\.budgets\s*\?/.test(works) &&
    /cost:\s*authorizedCost\s*===\s*null\s*\?\s*null/.test(works) &&
    /margin:\s*item\.visibility\.marginPercent\s*\?/.test(works) &&
    /item\.budget\s*!=\s*null|item\.cost\s*!=\s*null|item\.margin\s*!=\s*null/.test(portfolio),
);

check(
  "listado y ficha conservan consultas tenant-scoped",
  works.includes('requireCapability("work.view")') &&
    works.includes('resolveScopedEntityIds(auth, "work.view", "Work")') &&
    /where:\s*\{\s*companyId,\s*\.\.\.scopeWhere/.test(works) &&
    work.includes('requireCapability("work.view")') &&
    work.includes('resolveScopedEntityIds(auth, "work.view", "Work")') &&
    work.includes("where: { id, companyId: auth.companyId }"),
);

const progressSources = `${works}\n${portfolio}\n${work}`;
const inventedReferencePercentages = /["'`](?:68|52|35|10|95|25|60)%["'`]/.test(progressSources);
const syntheticProgressField = /\b(?:porcentajeAvance|progresoFisico|physicalProgress|calculateWorkProgress|deriveWorkProgress)\b/.test(progressSources);
const hardcodedProgress = /\b(?:progress|avance)\s*:\s*(?:68|52|35|10|95|25|60)\b/.test(progressSources);
check(
  "Trabajo no inventa porcentajes de progreso inexistentes",
  !inventedReferencePercentages && !syntheticProgressField && !hardcodedProgress,
);

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[work-operating-system] OK", name);
  else {
    failed += 1;
    console.error("[work-operating-system] FAIL", name);
  }
}
console.log(`[work-operating-system] ${cases.length - failed}/${cases.length}`);
if (failed) process.exit(1);
