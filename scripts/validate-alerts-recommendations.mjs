import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const files = {
  alertsPage: read("app/(app)/alertas/page.tsx"),
  alertsActions: read("app/(app)/alertas/actions.ts"),
  alertUseCases: read("lib/application/operations/alert-use-cases.ts"),
  signalEngine: read("lib/business-signals.ts"),
  recommendationsPage: read("app/(app)/recomendaciones/page.tsx"),
  recommendationActions: read("app/(app)/recomendaciones/actions.ts"),
  recommendationUseCases: read("lib/application/intelligence/recommendation-use-cases.ts"),
  recommendationEngine: read("lib/business-recommendations.ts"),
};

const checks = [];

function check(name, run) {
  run();
  checks.push(name);
}

function includesAll(source, labels, context) {
  for (const label of labels) {
    assert.ok(source.includes(label), `${context}: falta ${label}`);
  }
}

check("Alertas conserva arquitectura de resumen, filtros, grupos y detalle explicable", () => {
  includesAll(files.alertsPage, [
    "Alertas y recomendaciones",
    "data-alerts-recommendations-page",
    "styles.filters",
    "AlertRow",
    "RecommendationRow",
    "ImpactedCard",
    "Revisión humana",
    "signal.explanation.why",
    "signal.explanation.rule",
  ], "alertas");
});

check("Alertas deriva lectura y mutaciones desde la empresa autorizada", () => {
  includesAll(files.alertsPage, [
    'requireCapability("orqena.execute")',
    "getBusinessSignals({ companyId",
  ], "lectura de alertas");
  includesAll(files.alertUseCases, [
    'requireCapability("orqena.execute")',
    "signalBelongsToCompany(fingerprint, companyId)",
    "where: { fingerprint, companyId }",
  ], "mutaciones de alertas");
});

check("La carga de estados de alertas nunca consulta sólo por fingerprint", () => {
  assert.ok(
    /loadSignalStates\(drafts\.map\(\(signal\) => signal\.fingerprint\), companyId\)/.test(files.signalEngine),
    "alertas: loadOrSyncSignalStates debe propagar companyId al cargar estados",
  );
  assert.ok(
    /async function loadSignalStates\(fingerprints: string\[\], companyId: string\)/.test(files.signalEngine),
    "alertas: loadSignalStates debe exigir companyId",
  );
  assert.ok(
    /businessSignalState\.findMany\(\{\s*where:\s*\{\s*fingerprint:\s*\{\s*in:\s*fingerprints\s*\},\s*companyId\s*\}\s*\}\)/.test(files.signalEngine),
    "alertas: la consulta de estados debe filtrar fingerprint y companyId",
  );
  assert.ok(
    !/businessSignalState\.findMany\(\{\s*where:\s*\{\s*fingerprint:\s*\{\s*in:\s*fingerprints\s*\}\s*\}\s*\}\)/.test(files.signalEngine),
    "alertas: detectada consulta cross-tenant de estados sólo por fingerprint",
  );
});

check("El ciclo de vida de alertas conserva companyId en lectura y escritura", () => {
  for (const operation of ["dismissBusinessSignal", "snoozeBusinessSignal", "resolveBusinessSignal"]) {
    assert.match(
      files.signalEngine,
      new RegExp(`export async function ${operation}\\(companyId: string, fingerprint: string`),
      `alertas: ${operation} debe exigir companyId`,
    );
  }
  assert.ok(
    (files.signalEngine.match(/where:\s*\{\s*fingerprint, companyId\s*\}/g) ?? []).length >= 6,
    "alertas: las lecturas y escrituras del ciclo de vida deben combinar fingerprint y companyId",
  );
});

check("Alertas enlaza destinos reales y acciones server-side", () => {
  includesAll(files.alertsPage, [
    'href="/recomendaciones?estado=all"',
    "href={entityHref}",
    "recommendationHref(recommendation)",
    "href={item.href}",
    "action={snoozeSignalAction}",
    "action={resolveSignalAction}",
    "action={dismissSignalAction}",
  ], "acciones de alertas");
  includesAll(files.alertsActions, [
    "executeNextAction",
    "alert-use-cases",
  ], "frontera server-side de alertas");
});

check("Recomendaciones conserva listado, detalle, filtros, trazabilidad y navegación", () => {
  includesAll(files.recommendationsPage, [
    "Centro de recomendaciones",
    "RecommendationFilters",
    "RecommendationListItem",
    "RecommendationDetail",
    "RecommendationBreadcrumbs",
    "Por qué y seguimiento",
    'href="/recomendaciones/control"',
    'href="/alertas"',
  ], "centro de recomendaciones");
});

check("Recomendaciones limita lectura y selección al tenant activo", () => {
  includesAll(files.recommendationsPage, [
    'requireCapability("orqena.execute")',
    "getBusinessRecommendations({",
    "companyId,",
    "result.recommendations.find",
  ], "lectura de recomendaciones");
  includesAll(files.recommendationEngine, [
    "getRecommendationStateByFingerprint(fingerprint)",
    "requireCompanyContext()",
    "where: { fingerprint, companyId }",
  ], "estado tenant de recomendaciones");
});

check("Recomendaciones usa acciones server-side y destinos accionables", () => {
  includesAll(files.recommendationsPage, [
    "recommendationsHref(filters, recommendation.id)",
    "action={markRecommendationViewedAction}",
    "action={snoozeRecommendationAction}",
    "action={dismissRecommendationAction}",
    "action={acceptRecommendationAction}",
    "action={executeRecommendationAction}",
  ], "acciones de recomendaciones");
  includesAll(files.recommendationActions, [
    "executeNextAction",
    "recommendation-use-cases",
  ], "frontera server-side de recomendaciones");
});

check("La ejecución sensible exige confirmación humana e idempotencia", () => {
  includesAll(files.recommendationsPage, [
    'name="actionId"',
    'name="confirmed" value="true"',
    'name="idempotencyKey"',
  ], "formulario de confirmación");
  includesAll(files.recommendationUseCases, [
    'requireCapability("orqena.execute")',
    'clean(formData.get("confirmed")) === "true"',
    "if (!fingerprint || !actionId || !confirmed) return",
    "executeConfirmedRecommendationAction",
    "idempotencyKey",
  ], "caso de uso confirmado");
  includesAll(files.recommendationEngine, [
    "if (!action.requiresConfirmation)",
    "idempotencyKey: key",
    "state.companyId",
  ], "motor de recomendaciones");
});

console.log(`[alerts-recommendations] ${checks.length}/${checks.length}`);
for (const name of checks) console.log(`[alerts-recommendations] OK ${name}`);
