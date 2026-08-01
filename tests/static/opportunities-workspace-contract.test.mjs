import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pagePath = new URL("../../app/(app)/oportunidades/page.tsx", import.meta.url);
const cssPath = new URL("../../app/(app)/oportunidades/page.module.css", import.meta.url);
const railPath = new URL("../../components/portal/orqena-context-rail.tsx", import.meta.url);
const page = readFileSync(pagePath, "utf8");
const css = readFileSync(cssPath, "utf8");
const rail = readFileSync(railPath, "utf8");

test("oportunidades mantiene aislamiento tenant y alcance comercial", () => {
  assert.match(page, /requireCapability\("sales\.budgets\.view"\)/);
  assert.match(page, /companyId:\s*auth\.companyId/);
  assert.match(page, /resolveScopedEntityIds\(auth,\s*"sales\.budgets\.view",\s*"Work"\)/);
  assert.match(page, /resolveScopedEntityIds\(auth,\s*"sales\.budgets\.view",\s*"Client"\)/);
});

test("el pipeline sólo usa estados persistidos de Budget", () => {
  for (const state of [
    "borrador",
    "pendiente_revision",
    "enviado",
    "visto",
    "pendiente_respuesta",
    "aceptado",
    "rechazado",
    "caducado",
  ]) assert.match(page, new RegExp(`"${state}"`));
  assert.doesNotMatch(page, /probability\s*:|weightedValue|conversionProbability/i);
  assert.match(page, /sin probabilidades estimadas/i);
});

test("todos los controles visibles tienen un destino o una acción real", () => {
  assert.match(page, /action="\/oportunidades"/);
  assert.match(page, /href=\{`\/presupuestos\/\$\{budget\.id\}`\}/);
  assert.match(page, /href="\/gestion\?tipo=presupuesto&returnTo=\/oportunidades"/);
  assert.match(page, /type="submit">Aplicar/);
});

test("la presentación conserva una arquitectura compacta y responsive", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /grid-template-columns:\s*repeat\(6,/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
});

test("Orqena IA usa el rail compartido con contexto comercial real", () => {
  assert.doesNotMatch(page, /OpportunitiesContextShell/);
  assert.match(rail, /path === "\/oportunidades"/);
  assert.match(rail, /area: "budgets"/);
  assert.match(rail, /Presupuestos reales autorizados para tu perfil/);
  assert.match(rail, /No se calcula probabilidad ni se ejecutan cambios/);
  assert.doesNotMatch(css, /routeLayout|aiRail|orqena-context-rail/);
});
