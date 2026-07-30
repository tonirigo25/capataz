import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const header = read("app/marketing-v2/_components/marketing-header.tsx");
const hero = read("app/marketing-v2/_components/hero-demo.tsx");
const landing = read("app/marketing-v2/_components/landing-sections.tsx");
const story = read("app/marketing-v2/_components/immersive-journey.tsx");
const demo = read("app/demo-v2/_components/guided-demo.tsx");
const css = read("app/marketing-v2/page.module.css");
const homePage = read("app/page.tsx");
const canonicalMarketingHome = read("app/marketing-internal/[[...slug]]/page.tsx");
const hostRouting = read("lib/host-routing.ts");
const demoPage = read("app/demo/page.tsx");
const form = read("components/marketing/demo-request-form.tsx");
const budget = JSON.parse(read("contracts/observability/v1/web-performance-budget.json"));
const failures = [];
let checks = 0;

const check = (label, condition) => {
  checks += 1;
  if (condition) {
    process.stdout.write(`[d2-public] OK ${label}\n`);
    return;
  }
  failures.push(label);
  process.stderr.write(`[d2-public] FAIL ${label}\n`);
};

check(
  "header V2 orientado a resultados",
  ["Producto", "Soluciones", "Precios", "Recursos", "Empresa", "Iniciar sesión", "Solicitar demo"].every((label) => header.includes(label))
    && header.includes("onMouseEnter={onOpen}")
    && header.includes("aria-expanded={open}")
    && header.includes("onBlur={onBlur}"),
);
check(
  "hero V2 exacto",
  hero.includes("CAPATAZ · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS")
    && hero.includes("Gestiona tu empresa.")
    && hero.includes("Ahorra tiempo.")
    && hero.includes("Toma el control.")
    && hero.includes("Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA conectados en un único sistema. Capataz prepara; tú revisas y confirmas."),
);
check("CTA V2 exactas", hero.includes("Solicitar demo") && hero.includes("Ver cómo funciona"));
check(
  "producto visible e interactivo",
  ["Hoy", "Clientes", "Trabajo", "Dinero"].every((label) => hero.includes(`label: "${label}"`))
    && hero.includes('label: `${brand.productName} IA`')
    && hero.includes('role="tablist"')
    && hero.includes("onKeyDown"),
);
check(
  "franja de valor",
  ["Todo conectado", "IA con control humano", "Datos aislados y seguros", "Acceso web y móvil"].every((label) => hero.includes(label)),
);
check(
  "menús claros con puente de hover y drawer seguro",
  css.includes(".megaMenuRoot::after")
    && css.includes("overflow: visible")
    && header.includes('document.body.style.overflow = "hidden"')
    && header.includes("MobileAccordion")
    && header.includes("closeDrawer"),
);
const publicAnchorIds = new Set([
  ...[...landing.matchAll(/id="([^"]+)"/gu)].map((match) => match[1]),
  ...[...landing.matchAll(/id:\s*"([^"]+)"/gu)].map((match) => match[1]),
]);
const menuAnchorTargets = [...header.matchAll(/href:\s*"\/#([^"]+)"/gu)].map((match) => match[1]);
check(
  "enlaces del mega menú resuelven a anclas existentes",
  menuAnchorTargets.length >= 28 && menuAnchorTargets.every((target) => publicAnchorIds.has(target)),
);
check(
  "CTA de demo usa una ruta pública real",
  (header.match(/href="\/contacto\?motivo=demo"/gu)?.length ?? 0) >= 3
    && hero.includes('href="/contacto?motivo=demo"')
    && !header.includes("/demo#solicitar-acceso"),
);
check(
  "sticky story de cinco etapas",
  (story.match(/^\s{4}id: "/gmu) ?? []).length === 5
    && ["Contacto y visita", "Presupuesto", "Trabajo y planificación", "Compras y costes", "Factura y cobro"].every((label) => story.includes(label)),
);
check(
  "resultados, responsabilidad, móvil, confianza y FAQ",
  ['id="resultados"', 'id="para-quien"', 'id="captura-movil"', 'id="confianza"', 'id="preguntas"'].every((marker) => landing.includes(marker)),
);
check(
  "formulario persistente",
  landing.includes('<DemoRequestForm kind="home" />')
    && form.includes('fetch("/api/demo-requests"')
    && form.includes('name="consent"'),
);
check(
  "demo sin registro y sintética",
  demo.includes('id="quick-demo"')
    && demo.includes("no necesitas registrarte")
    && demo.includes("datos de ejemplo")
    && demo.includes("servicio externo"),
);
check(
  "demo editable, teclado, confirmación, resultado y CTA real",
  demo.includes("onKeyDown")
    && demo.includes("onUpdate")
    && demo.includes("Confirmar simulación")
    && demo.includes("Resultado simulado")
    && demo.includes("Solicitar una demo real"),
);
check(
  "metadata y schema coherentes",
  homePage.includes('type="application/ld+json"')
    && homePage.includes('"@type": "WebApplication"')
    && demoPage.includes('type="application/ld+json"')
    && demoPage.includes('"@type": "SoftwareApplication"'),
);
check(
  "host público canónico usa Field OS V2 y acepta captación protegida",
  canonicalMarketingHome.includes("<FieldOsMarketingHeader />")
    && canonicalMarketingHome.includes("<HeroDemo />")
    && canonicalMarketingHome.includes("<LandingSections />")
    && hostRouting.includes('"/api/demo-requests"'),
);
check("sin imágenes sin dimensiones", ![hero, landing, story, demo].some((source) => /<img\b/iu.test(source)));
check(
  "presupuesto Web Vitals D2",
  budget.budgets.LCP.maximum <= 2500
    && budget.budgets.INP.maximum <= 200
    && budget.budgets.CLS.maximum <= 0.1,
);
check(
  "sin llamadas externas en UI D2",
  ![hero, landing, story, demo, form].some((source) => /fetch\(\s*["']https?:\/\//iu.test(source)),
);

if (failures.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, phase: "D2", checks, failures }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ ok: true, phase: "D2", checks, externalCalls: 0, productionWrites: 0, stagingWrites: 0 })}\n`);
