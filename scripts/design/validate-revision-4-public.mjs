import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];
let checks = 0;

function check(label, run) {
  try {
    run();
    checks += 1;
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

check("canonical brand contract", () => {
  const source = read("lib/config/brand.ts");
  for (const token of [
    'companyName: "Orqena Tech"',
    'productName: "Orqena"',
    'assistantName: "Orqena IA"',
    'publicUrl: "https://orqenatech.com"',
    'appUrl: "https://app.orqenatech.com"',
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(read("lib/brand.ts"), /productSignature:\s*`\$\{brandConfig\.productName\}, by \$\{brandConfig\.companyName\}`/);
});

check("email and PWA consume canonical brand", () => {
  const email = read("lib/email/index.ts");
  assertAbsent(email, /\bCapataz\b/u, "legacy product name");
  assert.match(email, /brand\.productName/);
  assert.match(email, /brand\.companyName/);
  const manifest = read("app/manifest.ts");
  assert.match(manifest, /name:\s*brand\.pwa\.name/);
  assert.match(manifest, /short_name:\s*brand\.pwa\.shortName/);
});

check("legacy public route redirects without breaking app alias", () => {
  const routing = read("lib/host-routing.ts");
  assert.match(routing, /pathname === "\/capataz"[\s\S]{0,180}marketingUrl\("\/producto"\)[\s\S]{0,80}status: 301/);
  assert.match(routing, /function appDecision[\s\S]+pathname === "\/capataz"\) return \{ action: "pass", site: "app" \}/);
  assert.match(routing, /canonicalMarketingPath/);
});

check("indexing remains fail-closed in validation environments", () => {
  const indexing = read("lib/public-indexing.ts");
  assert.match(indexing, /config\.environment === "staging"/);
  assert.match(indexing, /config\.environment === "test"/);
  assert.match(indexing, /railwayEnvironment\.includes\("review"\)/);
  assert.match(indexing, /config\.publicIndexingEnabled && !isValidationEnvironment/);
  const sitemap = read("app/sitemap.ts");
  assert.match(sitemap, /if \(!isPublicIndexingEnabled\(\)\) return \[\]/);
  assert.match(sitemap, /brand\.publicUrl/);
  assertAbsent(sitemap, /\/capataz["'`]/, "legacy public route in sitemap");
});

check("SEO and copy contracts exist", () => {
  for (const path of [
    "docs/seo/PUBLIC_ROUTE_MAP.md",
    "docs/seo/KEYWORD_INTENT_MAP.md",
    "docs/seo/REDIRECT_MAP.md",
    "docs/seo/LEGACY_BRAND_IDENTIFIERS.md",
    "docs/marketing/COPY_DECK_ES.md",
  ]) assert.equal(existsSync(join(root, path)), true, `${path} is missing`);
});

const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".html", ".json", ".txt", ".svg", ".xml", ".csv"]);
const publicRoots = [
  "app/page.tsx",
  "app/marketing-internal",
  "app/marketing-v2",
  "app/producto",
  "app/soluciones",
  "app/precios",
  "app/planes",
  "app/recursos",
  "app/empresa",
  "app/contacto",
  "app/demo",
  "app/demo-v2",
  "app/seguridad",
  "app/estado",
  "components/marketing",
  "lib/email",
  "lib/document-pdf.ts",
  "lib/document-pdf-assets.ts",
  "lib/document-templates.ts",
  "lib/simple-pdf.ts",
  "templates/documents",
  "docs/marketing/COPY_DECK_ES.md",
  "artifacts/design-v2/correction-pr63/gate-1-revision-4",
];

const files = publicRoots.flatMap((path) => collect(join(root, path)));
const personalDataPatterns = [
  /\btoni\b/iu,
  /\brigo\b/iu,
  /tonirigo25/iu,
  /tonirigo25@hotmail\.com/iu,
  /@hotmail\.com\b/iu,
];

for (const absolutePath of files) {
  const displayPath = relative(root, absolutePath).replaceAll("\\", "/");
  check(`safe fixture filename ${displayPath}`, () => {
    for (const pattern of personalDataPatterns) assertAbsent(displayPath, pattern, "owner data in filename");
    assertAbsent(displayPath, /\bCapataz\b/u, "legacy brand in filename");
  });
  if (!textExtensions.has(extname(absolutePath).toLowerCase())) continue;
  const source = readFileSync(absolutePath, "utf8");
  check(`safe public source ${displayPath}`, () => {
    for (const pattern of personalDataPatterns) assertAbsent(source, pattern, "owner data");
    assertAbsent(source, /\bCapataz\b/u, "legacy public brand");
    assertAbsent(source, /brand\.legacyAliases/u, "legacy aliases cannot feed public copy");
  });
}

if (failures.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, suite: "revision-4-public", checks, failures }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ ok: true, suite: "revision-4-public", checks, scannedFiles: files.length })}\n`);
}

function collect(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? collect(child) : [child];
  });
}

function assertAbsent(source, pattern, label) {
  const match = pattern.exec(source);
  if (!match) return;
  const line = source.slice(0, match.index).split(/\r?\n/u).length;
  throw new Error(`${label} at line ${line}`);
}
