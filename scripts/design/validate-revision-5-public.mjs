import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];
let checks = 0;

const paths = {
  immersive: "app/marketing-v2/_components/immersive-journey.tsx",
  flow: "app/marketing-v2/_components/public-flow-showcase.tsx",
  landing: "app/marketing-v2/_components/landing-sections.tsx",
  header: "app/marketing-v2/_components/marketing-header.tsx",
  hostRouting: "lib/host-routing.ts",
  routeAccess: "lib/route-access.ts",
  layout: "app/layout.tsx",
  structuredData: "components/marketing/public-structured-data.tsx",
  publicMatrix: "scripts/design/validate-d10-public-matrix.mjs",
  lighthouse: "lighthouserc.cjs",
  mp4: "public/media/marketing/orqena-video-01-35s.mp4",
  webm: "public/media/marketing/orqena-video-01-35s.webm",
  poster: "public/media/marketing/orqena-video-01-poster.webp",
};

const immersive = read(paths.immersive);
const flow = read(paths.flow);
const landing = read(paths.landing);
const header = read(paths.header);
const hostRouting = read(paths.hostRouting);
const routeAccess = read(paths.routeAccess);
const layout = read(paths.layout);
const structuredData = read(paths.structuredData);
const publicMatrix = read(paths.publicMatrix);
const lighthouse = read(paths.lighthouse);

function check(label, run) {
  try {
    run();
    checks += 1;
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

check("optimized video assets exist within their hard budgets", () => {
  assertFileBetween(paths.mp4, 1, 12 * 1024 * 1024);
  assertFileBetween(paths.webm, 1, 7 * 1024 * 1024);
  assertFileBetween(paths.poster, 1, 1024 * 1024);
});

check("the approved 35-second film uses WebM, MP4 and poster fallbacks", () => {
  for (const token of [
    'poster="/media/marketing/orqena-video-01-poster.webp"',
    '<source src="/media/marketing/orqena-video-01-35s.webm" type="video/webm" />',
    '<source src="/media/marketing/orqena-video-01-35s.mp4" type="video/mp4" />',
    "Orqena en acción · 35 s",
    "Tu navegador no puede reproducir este vídeo.",
  ]) assertIncludes(immersive, token, `film contract: ${token}`);
});

check("film playback is lazy, muted, inline and never loops indefinitely", () => {
  for (const token of ["muted", "playsInline", 'preload="metadata"', "onEnded={handleFilmEnded}"]) {
    assertIncludes(immersive, token, `media attribute: ${token}`);
  }
  assert.doesNotMatch(immersive, /<video[\s\S]{0,520}\bautoPlay\b/u);
  assert.doesNotMatch(immersive, /<video[\s\S]{0,520}\bloop\b/u);
  assert.match(immersive, /filmCycleCountRef\.current\s*<\s*1/u);
});

check("film and guided journey start independently after two visible seconds", () => {
  assertIncludes(immersive, "const [filmPlaying, setFilmPlaying]", "independent film state");
  assertIncludes(immersive, "const [journeyPlaying, setJourneyPlaying]", "independent guided state");
  assertIncludes(immersive, "setFilmInViewport", "film viewport state");
  assertIncludes(immersive, "setJourneyInViewport", "journey viewport state");
  assert.ok((immersive.match(/\},\s*2000\);/gu) ?? []).length >= 2, "both observers must wait exactly 2000 ms");
  assert.match(immersive, /videoRef\.current\?\.pause\(\);/u);
});

check("film exposes a visible accessible play and pause control", () => {
  for (const token of [
    "styles.guidedFilmPlayback",
    'aria-label={filmPlaying ? "Pausar vídeo de Orqena" : "Reproducir vídeo de Orqena"}',
    "aria-pressed={filmPlaying}",
    "onClick={toggleFilmPlayback}",
    "disabled={reducedMotion}",
  ]) assertIncludes(immersive, token, `film control: ${token}`);
});

check("guided journey contains five stages, fifteen scenes and three-second scene cadence", () => {
  for (const stage of ["contacto", "presupuesto", "trabajo", "compras", "cobro"]) {
    assertIncludes(immersive, `id: "${stage}"`, `guided stage ${stage}`);
  }
  assert.match(immersive, /const SCENE_MS\s*=\s*3000;/u);
  assertIncludes(immersive, "const totalScenes = stages.length * 3", "fifteen-scene computation");
  for (const control of ["Reiniciar demo", "Anterior", "Pausar", "Reproducir", "Siguiente"]) {
    assertIncludes(immersive, control, `guided control ${control}`);
  }
});

check("guided journey has credible context and human-confirmed actions", () => {
  for (const token of [
    "Orqena prepara",
    "Tú confirmas",
    "Próxima acción",
    "caso sintético",
    "siempre con revisión humana",
    "no se han escrito datos",
    'role="status" aria-live="polite"',
  ]) assertIncludes(immersive, token, `guided safety or context: ${token}`);
});

check("Producto en movimiento is commercial, explicit and advances every six seconds", () => {
  for (const stage of ["Contacto", "Presupuesto", "Trabajo", "Compras", "Factura", "Cobro"]) {
    assertIncludes(flow, `label: "${stage}"`, `public flow stage ${stage}`);
  }
  for (const label of ["Entra", "Orqena conecta", "Tú decides", "Sale preparado"]) {
    assertIncludes(flow, `<dt>${label}</dt>`, `flow explanation ${label}`);
  }
  assert.match(flow, /const FLOW_AUTOPLAY_MS\s*=\s*6000;/u);
  assertIncludes(flow, "FLOW_AUTOPLAY_MS", "flow timer use");
  assertIncludes(flow, "Pendiente de confirmación humana", "flow human gate");
});

check("private demo states the complete controlled offer", () => {
  for (const token of [
    "7 días",
    "1 usuario",
    "100 operaciones IA",
    "Sin tarjeta",
    "Sin cargos automáticos",
    "menos de 24 horas laborables",
    "Datos sintéticos, acceso controlado y ninguna escritura en tu negocio.",
  ]) assertIncludes(landing, token, `private demo term: ${token}`);
});

check("public navigation contains no known broken solution or product anchors", () => {
  const combined = `${header}\n${landing}`;
  for (const stale of [
    "/producto#clientes",
    "/producto#trabajo",
    "/producto#equipo",
    "/producto#documentos",
    "/producto#dinero",
    "/producto#ia",
    "/soluciones/autonomos",
    "/soluciones/pymes-construccion",
    "/soluciones/control-de-obras",
    "capataz-ia",
  ]) assert.doesNotMatch(combined, new RegExp(escapeRegExp(stale), "iu"), `stale public target ${stale}`);
});

check("marketing video is a shared public static resource on every approved host", () => {
  assertIncludes(hostRouting, '"/media/marketing/"', "shared marketing media prefix");
  assertIncludes(routeAccess, 'pathname.startsWith("/media/marketing/")', "public route access prefix");
});

check("SEO stays canonical, fail-closed and covered on the requested public routes", () => {
  assertIncludes(layout, "metadataBase: new URL(brand.publicUrl)", "canonical public metadata base");
  assert.match(hostRouting, /pathname === "\/robots\.txt" \|\| pathname === "\/sitemap\.xml"[\s\S]{0,120}action: "pass"/u);
  for (const route of ["/producto", "/demo", "/precios", "/recursos", "/empresa", "/contacto"]) {
    assertIncludes(lighthouse, `http://127.0.0.1:3210${route}`, `Lighthouse route ${route}`);
  }
  assertIncludes(lighthouse, '"largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]', "LCP 2.5-second gate");
  assertIncludes(lighthouse, 'onlyCategories: ["performance", "accessibility", "best-practices", "seo"]', "Lighthouse SEO audit");
  assertIncludes(lighthouse, "Review is intentionally noindex", "Review SEO score exception");
  for (const route of ["/recursos", "/empresa"]) assertIncludes(publicMatrix, `"${route}"`, `D10 route ${route}`);
  for (const token of ["x-nonce", "BreadcrumbList", "FAQPage", "SoftwareApplication", "\\u003c"]) {
    assertIncludes(structuredData, token, `safe structured data token ${token}`);
  }
});

check("public UI source contains no personal identity or legacy product copy", () => {
  const visibleSource = `${immersive}\n${flow}\n${landing}\n${header}`;
  for (const forbidden of ["Capataz", "Toni", "Rigo", "tonirigo25"]) {
    assert.doesNotMatch(visibleSource, new RegExp(`\\b${forbidden}\\b`, "iu"), `forbidden public term ${forbidden}`);
  }
});

if (failures.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, suite: "revision-5-public", checks, failures }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ ok: true, suite: "revision-5-public", checks })}\n`);
}

function assertIncludes(source, token, label) {
  assert.ok(source.includes(token), `missing ${label}`);
}

function assertFileBetween(path, minimum, maximum) {
  const absolutePath = join(root, path);
  assert.equal(existsSync(absolutePath), true, `${path} is missing`);
  const size = statSync(absolutePath).size;
  assert.ok(size >= minimum, `${path} is empty`);
  assert.ok(size <= maximum, `${path} exceeds ${maximum} bytes`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
