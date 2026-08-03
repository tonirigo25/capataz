import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/(app)/recomendaciones/page.tsx", "utf8");
const styles = readFileSync(
  "app/(app)/recomendaciones/recommendations-page.module.css",
  "utf8",
);

test("Recomendaciones conserva filtros, selección y retorno en la misma vista", () => {
  assert.match(page, /seleccion\?: string/);
  assert.match(page, /recommendationsHref\(filters, recommendation\.id\)/);
  assert.match(page, /backHref=\{recommendationsHref\(filters\)\}/);
  assert.match(page, /<RecommendationFilters/);
});

test("las acciones sensibles siguen en formularios servidor y con confirmación humana", () => {
  assert.match(page, /form action=\{executeRecommendationAction\}/);
  assert.match(page, /form action=\{acceptRecommendationAction\}/);
  assert.match(page, /form action=\{snoozeRecommendationAction\}/);
  assert.match(page, /form[\s\S]*action=\{dismissRecommendationAction\}/);
  assert.match(page, /Confirmación humana/);
});

test("el workspace usa densidad compacta y se recompone en móvil", () => {
  assert.match(styles, /\.workspace\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /\.recommendationRow > a\s*\{[\s\S]*min-height: 102px/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.workspace\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 560px\)/);
});
