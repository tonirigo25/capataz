import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE_SHA = "21412ff4a500394ea97939fd604374612b44dcda";
const read = (path) => readFileSync(path, "utf8");
const tokens = JSON.parse(read("design/design-tokens.json"));
const manifest = JSON.parse(read("design/field-os-manifest.json"));
const styles = read("app/globals.css");
const routeMatrix = read("docs/design/ROUTE_MATRIX.csv").trim().split(/\r?\n/u);
const runtimeRoutes = read("lib/route-experience-manifest.ts");
const productNavigation = read("lib/product-navigation.ts");
const appChrome = read("components/app-chrome.tsx");

const failures = [];
const pass = (label, condition, detail = "") => {
  if (condition) {
    console.log(`[field-os] OK ${label}`);
    return;
  }
  failures.push(detail ? `${label}: ${detail}` : label);
  console.error(`[field-os] FAIL ${label}${detail ? `: ${detail}` : ""}`);
};

const normalize = (value) => String(value).toLowerCase().replace(/\s+/gu, "");
const relativeLuminance = (hex) => {
  const channels = String(hex).replace("#", "").match(/.{2}/gu)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
};
const contrastRatio = (foreground, background) => {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
const cssVariables = new Map(
  [...styles.matchAll(/(--fos-[a-z0-9-]+)\s*:\s*([^;]+);/giu)]
    .map(([, name, value]) => [name, value.trim()]),
);

const tokenMappings = [
  ["--fos-color-ink", tokens.color.ink.value],
  ["--fos-color-ink-muted", tokens.color.inkMuted.value],
  ["--fos-color-stone", tokens.color.stone.value],
  ["--fos-color-paper", tokens.color.paper.value],
  ["--fos-color-surface", tokens.color.surface.value],
  ["--fos-color-line", tokens.color.line.value],
  ["--fos-color-lime", tokens.color.lime.value],
  ["--fos-color-blue", tokens.color.blue.value],
  ["--fos-color-orange", tokens.color.orange.value],
  ["--fos-color-red", tokens.color.red.value],
  ["--fos-color-green", tokens.color.green.value],
  ["--fos-font-sans", tokens.typography.family.sans],
  ["--fos-font-mono", tokens.typography.family.mono],
  ["--fos-text-xs", tokens.typography.size.xs],
  ["--fos-text-sm", tokens.typography.size.sm],
  ["--fos-text-base", tokens.typography.size.base],
  ["--fos-text-lg", tokens.typography.size.lg],
  ["--fos-text-xl", tokens.typography.size.xl],
  ["--fos-text-display", tokens.typography.size.display],
  ["--fos-radius-sm", tokens.radius.sm],
  ["--fos-radius-md", tokens.radius.md],
  ["--fos-radius-lg", tokens.radius.lg],
  ["--fos-radius-xl", tokens.radius.xl],
  ["--fos-radius-pill", tokens.radius.pill],
  ["--fos-shadow-small", tokens.shadow.small],
  ["--fos-shadow-card", tokens.shadow.card],
  ["--fos-shadow-hero", tokens.shadow.hero],
  ["--fos-layout-sidebar", tokens.layout.sidebar],
  ["--fos-layout-content-max", tokens.layout.contentMax],
  ["--fos-layout-record-rail", tokens.layout.recordRail],
  ["--fos-layout-client-split", tokens.layout.clientSplitPane],
  ["--fos-layout-desktop-breakpoint", tokens.layout.desktopBreakpoint],
  ["--fos-layout-mobile-width", tokens.layout.mobileWidth],
  ["--fos-motion-fast", tokens.motion.fast],
  ["--fos-motion-base", tokens.motion.base],
  ["--fos-motion-slow", tokens.motion.slow],
  ["--fos-motion-easing", tokens.motion.easing],
];

const semanticTokenMappings = [
  ["--fos-color-text-muted-aa", tokens.semanticColor.textMuted.value],
  ["--fos-color-warning-text-aa", tokens.semanticColor.warningText.value],
  ["--fos-color-danger-text-aa", tokens.semanticColor.dangerText.value],
];

for (const [name, expected] of [...tokenMappings, ...semanticTokenMappings]) {
  const actual = cssVariables.get(name);
  pass(`token ${name}`, normalize(actual) === normalize(expected), `expected ${expected}, received ${actual ?? "missing"}`);
}

pass(
  "semantic muted text meets AA on stone and lime",
  contrastRatio(tokens.semanticColor.textMuted.value, tokens.color.stone.value) >= 4.5
    && contrastRatio(tokens.semanticColor.textMuted.value, tokens.color.lime.value) >= 4.5,
);
pass(
  "semantic warning and danger text meet AA on paper",
  contrastRatio(tokens.semanticColor.warningText.value, tokens.color.paper.value) >= 4.5
    && contrastRatio(tokens.semanticColor.dangerText.value, tokens.color.paper.value) >= 4.5,
);
pass(
  "active navigation ink meets AA on lime",
  contrastRatio(tokens.color.ink.value, tokens.color.lime.value) >= 4.5,
);

pass("manifest baseline SHA", manifest.baselineSha === BASELINE_SHA);
pass("manifest review is independent", manifest.review?.independent === true && manifest.review?.syntheticDataOnly === true);
pass("manifest includes required viewports", [390, 430, 768, 1024, 1280, 1440, 1920].every((width) => manifest.viewports.some((item) => item.width === width)));
pass("manifest includes all synthetic profiles", manifest.profiles.length === 12);
pass("manifest includes edge states", ["loading", "empty", "error", "restricted", "read-only", "archive", "destructive-confirmation", "offline", "reduced-motion"].every((state) => manifest.states.includes(state)));
pass("manifest includes 18 archetypes", manifest.archetypes.length === 18);
pass("source route matrix contains 94 routes", routeMatrix.length === 95, `received ${routeMatrix.length - 1}`);
pass("runtime route manifest remains capability-aware", runtimeRoutes.includes('access: "capability"') && runtimeRoutes.includes('access: "platform"'));
pass("runtime shell contract uses Field OS sidebar", runtimeRoutes.includes('sidebarWidth: "var(--fos-layout-sidebar)"'));
pass("mobile shell exposes Capturar without eager permissions", runtimeRoutes.includes('capturePermissions: "on-selection"') && appChrome.includes('title="Capturar"'));
pass("capture sheet contains seven capability-aware actions", (productNavigation.match(/devicePermission:|label: "(?:Audio|Foto o ticket|Avance|Incidencia|Material|Parte|Documento)"/gu) ?? []).filter((item) => item.startsWith("label:")).length === 7);

const diff = execFileSync(
  "git",
  ["diff", "--unified=0", BASELINE_SHA, "--", "app", "components", "lib"],
  { encoding: "utf8", windowsHide: true },
);
let currentFile = "";
const arbitrary = [];
for (const line of diff.split(/\r?\n/u)) {
  if (line.startsWith("+++ b/")) {
    currentFile = line.slice(6);
    continue;
  }
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  const value = line.slice(1);
  const isFieldOsDeclaration = currentFile === "app/globals.css" && value.includes("--fos-");
  const isDedicatedPublicVisualStyle = currentFile === "app/globals.css"
    && /^\.(?:launch-|security-example|margin-calculator-result)/u.test(value.trim());
  const isSemanticColorInputDefault = currentFile === "app/(app)/configuracion/page.tsx"
    && value.includes('name="colorMarca"')
    && value.includes('type="color"');
  if (isFieldOsDeclaration || isDedicatedPublicVisualStyle || isSemanticColorInputDefault) continue;
  const hasHex = /#[0-9a-f]{3,8}\b/iu.test(value);
  const arbitraryTailwindValues = [...value.matchAll(/\b(?:rounded|shadow)-\[([^\]]+)\]/gu)]
    .map((match) => match[1].trim());
  const hasArbitraryTailwind = arbitraryTailwindValues.some((token) => !token.startsWith("var("));
  const radiusValue = value.match(/border-radius\s*:\s*([^;]+)/iu)?.[1].trim();
  const shadowValue = value.match(/box-shadow\s*:\s*([^;]+)/iu)?.[1].trim();
  const hasLiteralRadius = Boolean(radiusValue && radiusValue !== "0" && !radiusValue.startsWith("var("));
  const hasLiteralShadow = Boolean(shadowValue && shadowValue !== "none" && !shadowValue.startsWith("var("));
  if (hasHex || hasArbitraryTailwind || hasLiteralRadius || hasLiteralShadow) {
    arbitrary.push(`${currentFile}: ${value.trim()}`);
  }
}
pass("new visual code uses the token contract", arbitrary.length === 0, arbitrary.slice(0, 12).join(" | "));

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  baselineSha: BASELINE_SHA,
  tokens: tokenMappings.length + semanticTokenMappings.length,
  routes: routeMatrix.length - 1,
  profiles: manifest.profiles.length,
  states: manifest.states.length,
  archetypes: manifest.archetypes.length,
}, null, 2));
