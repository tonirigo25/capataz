import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const failures = [];
const requireText = (path, values) => {
  const source = read(path);
  for (const value of values) if (!source.includes(value)) failures.push(`${path}: falta ${value}`);
};

requireText("components/marketing/public-page-hero.tsx", [
  '"centered" | "split" | "wide-editorial"',
  "PublicHeroCopy",
  "PublicHeroVisual",
  "PublicHeroActions",
  "PublicHeroTrust",
  "PublicHeroMetrics",
  "PublicHeroMedia",
  "data-public-hero-layout",
]);
requireText("components/marketing/public-page-hero.module.css", [
  "80rem",
  "grid-template-columns: repeat(12",
  'data-public-hero-layout="split"',
  'data-public-hero-layout="centered"',
  'data-public-hero-layout="wide-editorial"',
  "@media (max-width: 64rem)",
]);
requireText("app/marketing-v2/_components/marketing-header.tsx", ['<Link className={styles.wordmark} href="/"']);
requireText("app/precios/page.tsx", ['variant="centered"']);
requireText("app/recursos/page.tsx", ['variant="wide-editorial"']);
requireText("app/empresa/page.tsx", ['variant="wide-editorial"']);
requireText("app/soluciones/page.tsx", ['variant="split"']);
requireText("app/contacto/page.tsx", ['variant="split"', 'visual={<DemoRequestForm']);
requireText("app/estado/page.tsx", ['variant="centered"']);
requireText("app/soporte/page.tsx", ['variant="centered"']);
requireText("app/producto/[modulo]/page.tsx", ['variant="split"', "ModuleSignatureScene"]);
requireText("app/sectores/[sector]/page.tsx", ['variant="split"', "SectorHeroScene"]);
requireText("app/sectores/page.tsx", ['variant="wide-editorial"']);
requireText("components/marketing/legal-public-page.tsx", ['variant="centered"', "compact"]);
requireText("app/marketing-internal/[[...slug]]/page.tsx", ['variant="centered"']);
requireText("app/marketing-v2/_components/hero-demo.tsx", ["data-hero-shell"]);

const heroCss = read("components/marketing/public-page-hero.module.css");
for (const forbidden of ["position: absolute", "transform: translate", "margin-left: -", "left: -"]) {
  if (heroCss.includes(forbidden)) failures.push(`public-page-hero.module.css: compensación prohibida ${forbidden}`);
}

if (failures.length) {
  console.error(`REVISION_6_PUBLIC_LAYOUT_FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("REVISION_6_PUBLIC_LAYOUT_PASS");
