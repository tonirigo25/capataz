import fs from "node:fs";
import { expect, loadTsModule } from "./ts-test-loader.mjs";

const NOW = new Date("2026-07-11T10:00:00.000Z");

const businessSignalMocks = {
  formatSignalLevel(level) {
    return { info: "INFO", atencion: "ATENCION", importante: "IMPORTANTE", critico: "CRITICO" }[level] ?? level;
  },
  signalSourceLabel(source) {
    return { facturas: "Facturas", cobros: "Cobros", presupuestos: "Presupuestos", obras: "Obras", tesoreria: "Tesoreria", crm: "CRM", datos: "Datos" }[source] ?? source;
  },
  signalLevelRank(level) {
    return { info: 1, atencion: 2, importante: 3, critico: 4 }[level] ?? 0;
  },
  resolveSnoozeUntil(preset, now = NOW) {
    const date = new Date(now);
    date.setDate(date.getDate() + (preset === "week" ? 7 : preset === "month" ? 30 : 1));
    date.setHours(9, 0, 0, 0);
    return date;
  },
  async getBusinessSignals() {
    return { signals: fixtureSignals(), summary: { top: fixtureSignals()[0], active: fixtureSignals().length } };
  }
};

const recommendationModule = () => loadTsModule("lib/business-recommendations.ts", {
  mocks: {
    "@/lib/business-signals": businessSignalMocks,
    "@/lib/prisma": { prisma: {} },
    "@/lib/proactive-audit": { logProactiveAuditEvent: async () => undefined }
  },
  aliases: {
    "@/lib/recommendation-actions": "lib/recommendation-actions.ts",
    "@/lib/format": "lib/format.ts",
    "@/lib/proactive-rules": "lib/proactive-rules.ts"
  }
});

const actionModule = () => loadTsModule("lib/recommendation-actions.ts");

function fixtureSignals() {
  return [
    signal({
      fingerprint: "invoice:overdue:inv-1",
      type: "invoice_overdue",
      title: "Factura F-2026-015 vencida",
      summary: "Factura vencida con saldo pendiente.",
      level: "critico",
      source: "cobros",
      entity: { type: "factura", id: "inv-1", label: "F-2026-015", href: "/dinero/inv-1" },
      client: { type: "cliente", id: "client-1", label: "MURHOTEL", href: "/clientes/client-1" },
      relatedAmount: 3200,
      score: 82
    }),
    signal({
      fingerprint: "work:low-margin:work-1",
      type: "work_low_margin",
      title: "Margen bajo en Obra Uno",
      summary: "Margen de obra por debajo del umbral.",
      level: "importante",
      source: "rentabilidad",
      entity: { type: "obra", id: "work-1", label: "Obra Uno", href: "/obras/work-1" },
      work: { type: "obra", id: "work-1", label: "Obra Uno", href: "/obras/work-1" },
      client: { type: "cliente", id: "client-1", label: "MURHOTEL", href: "/clientes/client-1" },
      relatedAmount: 1200,
      score: 70
    }),
    signal({
      fingerprint: "client:data:client-2",
      type: "client_data_incomplete",
      title: "Cliente sin CIF",
      summary: "Faltan datos fiscales.",
      level: "atencion",
      source: "datos",
      entity: { type: "cliente", id: "client-2", label: "Laura", href: "/clientes/client-2" },
      client: { type: "cliente", id: "client-2", label: "Laura", href: "/clientes/client-2" },
      relatedAmount: null,
      score: 44
    }),
    signal({
      fingerprint: "treasury:deficit:30d",
      type: "treasury_negative_cash",
      title: "Déficit previsto",
      summary: "Caja prevista negativa.",
      level: "importante",
      source: "tesoreria",
      entity: null,
      relatedAmount: 5000,
      score: 76
    })
  ];
}

function signal(overrides) {
  return {
    id: overrides.fingerprint,
    fingerprint: overrides.fingerprint,
    type: overrides.type,
    tipo: overrides.type,
    title: overrides.title,
    summary: overrides.summary,
    level: overrides.level,
    nivel: overrides.level,
    levelText: businessSignalMocks.formatSignalLevel(overrides.level),
    ruleId: overrides.type,
    ruleVersion: "2026-07-11.2",
    prioridad: overrides.score,
    score: overrides.score,
    date: NOW,
    fecha: NOW,
    startsAt: NOW,
    detectedAt: NOW,
    source: overrides.source,
    sourceLabel: businessSignalMocks.signalSourceLabel(overrides.source),
    entity: overrides.entity,
    client: overrides.client ?? null,
    work: overrides.work ?? null,
    relatedAmount: overrides.relatedAmount,
    status: "active",
    statusLabel: "Activa",
    explanation: {
      summary: overrides.summary,
      why: `${overrides.summary} Datos suficientes para recomendar una accion.`,
      dataUsed: ["saldo pendiente", "fecha de vencimiento", "prioridad"],
      rule: `Regla ${overrides.type}`,
      modules: [overrides.source],
      consequence: "Puede seguir acumulando retraso operativo.",
      scoreBreakdown: [{ label: "Base", value: overrides.score, detail: overrides.summary }]
    },
    suggestedActions: [],
    expiresAt: null,
    shownAt: null,
    dismissedAt: null,
    dismissedReason: null,
    dismissedBy: null,
    snoozedUntil: null,
    snoozeReason: null,
    resolvedAt: null,
    resolution: null
  };
}

function runEngineChecks() {
  const { buildRecommendationDraftsFromSignalsForTest } = recommendationModule();
  const recommendations = buildRecommendationDraftsFromSignalsForTest(fixtureSignals(), NOW);
  expect(recommendations.length >= 4, "[recommendations] expected actionable recommendations", recommendations.map((item) => item.type));

  const invoice = recommendations.find((item) => item.type === "invoice_collection");
  expect(invoice, "[recommendations] overdue invoice must create collection recommendation");
  expect(invoice.fingerprint === "recommendation:invoice_collection:inv-1", "[recommendations] invoice fingerprint must be stable", invoice.fingerprint);
  expect(invoice.preferredAction?.id === "create_collection_followup", "[recommendations] invoice preferred action should create followup");
  expect(invoice.requiresConfirmation === true, "[recommendations] mutating recommended action must require confirmation");
  expect(invoice.detailedExplanation.includes("Regla"), "[recommendations] recommendation must explain rule");
  expect(invoice.evidence.dataUsed.length > 0, "[recommendations] recommendation must preserve evidence");

  const work = recommendations.find((item) => item.type === "work_cost_review");
  expect(work?.preferredAction?.id === "review_work_costs", "[recommendations] work margin should route to cost review", work);

  const client = recommendations.find((item) => item.type === "client_data_completion");
  expect(client?.preferredAction?.id === "complete_client_data", "[recommendations] client data should route to complete data", client);

  const treasury = recommendations.find((item) => item.type === "treasury_review");
  expect(treasury?.preferredAction?.id === "view_treasury", "[recommendations] treasury recommendation should route to treasury", treasury);
}

function runDedupChecks() {
  const { buildRecommendationDraftsFromSignalsForTest, previewRecommendationStatusForTest } = recommendationModule();
  const signals = fixtureSignals();
  const recommendations = buildRecommendationDraftsFromSignalsForTest([...signals, signals[0]], NOW);
  const fingerprints = new Set(recommendations.map((item) => item.fingerprint));
  expect(fingerprints.size === recommendations.length, "[recommendations] duplicate signals must not duplicate recommendations");
  expect(previewRecommendationStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-12T09:00:00.000Z"), now: NOW }) === "snoozed", "[recommendations] snoozed recommendation must stay hidden until date");
  expect(previewRecommendationStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-10T09:00:00.000Z"), now: NOW }) === "active", "[recommendations] expired snooze should reactivate");
  expect(previewRecommendationStatusForTest({ status: "dismissed", lastPriority: 60, priority: 65, now: NOW }) === "dismissed", "[recommendations] dismissed should not return without material change");
  expect(previewRecommendationStatusForTest({ status: "dismissed", lastPriority: 60, priority: 80, now: NOW }) === "active", "[recommendations] material priority increase should reactivate");
}

function runActionChecks() {
  const { RECOMMENDATION_ACTIONS, resolveRecommendationAction } = actionModule();
  for (const id of ["view_invoice", "register_payment", "create_collection_followup", "view_client", "view_work", "view_treasury", "snooze_recommendation", "dismiss_recommendation"]) {
    expect(RECOMMENDATION_ACTIONS[id], `[recommendations] missing action ${id}`);
  }
  const action = resolveRecommendationAction("register_payment", { entityType: "invoice", invoiceId: "inv-1", returnTo: "/recomendaciones" });
  expect(action?.requiresConfirmation === true, "[recommendations] register_payment must require confirmation");
  expect(action?.href?.includes("tipo=pago"), "[recommendations] register_payment must route to payment draft", action);
  const blocked = resolveRecommendationAction("register_payment", { entityType: "client", clientId: "client-1" });
  expect(blocked === null, "[recommendations] action registry must reject incompatible entity");
}

function runFollowupChecks() {
  const source = fs.readFileSync("lib/business-recommendations.ts", "utf8");
  expect(source.includes("executeConfirmedRecommendationAction"), "[recommendations] missing confirmed execution handler");
  expect(source.includes("idempotencyKey"), "[recommendations] confirmed actions must use idempotency");
  expect(source.includes("create_collection_followup"), "[recommendations] missing collection followup handler");
  expect(source.includes("status: \"in_progress\""), "[recommendations] action-created outcome should not mark collection solved");
  expect(source.includes("status: \"obsolete\""), "[recommendations] stale recommendations must become obsolete");
}

function runChatChecks() {
  const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");
  const cases = [
    ["qué me recomiendas hacer hoy", "recommendations_today"],
    ["qué debería hacer primero", "recommendations_first"],
    ["qué recomendaciones importantes tengo", "recommendations_important"],
    ["qué puedo resolver rápido", "recommendations_quick_wins"],
    ["por qué me recomiendas esto", "recommendations_explain_current"],
    ["hazlo", "recommendations_do_current"],
    ["mejor el viernes", "recommendations_change_date_current"],
    ["recuérdamelo mañana", "recommendations_snooze_current"],
    ["descarta esta recomendación", "recommendations_dismiss_current"]
  ];
  for (const [text, action] of cases) {
    const result = classifyChatIntent(text);
    expect(result.action === action, `[recommendations] bad chat classification for ${text}`, result);
  }
  const actionsSource = fs.readFileSync("app/(app)/capataz/actions.ts", "utf8");
  for (const [, action] of cases) {
    expect(actionsSource.includes(`case "${action}"`), `[recommendations] missing chat handler for ${action}`);
  }
  expect(actionsSource.includes("lastRecommendation"), "[recommendations] chat must preserve lastRecommendation context");
  expect(actionsSource.includes("No he cambiado ningún registro"), "[recommendations] chat query must state no mutation");
}

function runCenterChecks() {
  const page = fs.readFileSync("app/(app)/recomendaciones/page.tsx", "utf8");
  const actions = fs.readFileSync("app/(app)/recomendaciones/actions.ts", "utf8");
  expect(page.includes("Centro de recomendaciones"), "[recommendations] missing recommendation center");
  expect(page.includes("Por qué y seguimiento"), "[recommendations] center must expose why panel");
  expect(page.includes("executeRecommendationAction"), "[recommendations] center must wire confirmed execution");
  expect(page.includes("confirmed") && page.includes("Confirmar"), "[recommendations] confirmed action must require explicit confirmation");
  expect(actions.includes("revalidatePath(\"/recomendaciones\")"), "[recommendations] actions must revalidate center");
  expect(actions.includes("executeConfirmedRecommendationAction"), "[recommendations] actions must use central confirmed handler");
}

function runIntegrationChecks() {
  const files = {
    chrome: fs.readFileSync("components/app-chrome.tsx", "utf8"),
    bottom: fs.readFileSync("components/bottom-nav.tsx", "utf8"),
    hoy: fs.readFileSync("app/(app)/hoy/page.tsx", "utf8"),
    client: fs.readFileSync("app/(app)/clientes/[id]/page.tsx", "utf8"),
    work: fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8"),
    treasury: fs.readFileSync("app/(app)/tesoreria/page.tsx", "utf8"),
    docs: fs.existsSync("docs/BLOQUE_3_RECOMENDACIONES_PROACTIVAS.md") ? fs.readFileSync("docs/BLOQUE_3_RECOMENDACIONES_PROACTIVAS.md", "utf8") : ""
  };
  expect(files.chrome.includes("/recomendaciones"), "[recommendations] app chrome must link recommendations");
  expect(files.bottom.includes("/recomendaciones"), "[recommendations] bottom nav must link recommendations");
  expect(!files.hoy.includes("getTodayRecommendationBrief"), "[recommendations] Hoy must keep automatic recommendations blocked during recovery");
  expect(files.client.includes("getRecommendationsForClient"), "[recommendations] Client 360 must show own recommendations");
  expect(files.work.includes("getRecommendationsForWork"), "[recommendations] Work 360 must show own recommendations");
  expect(files.treasury.includes("getTreasuryRecommendations"), "[recommendations] Treasury must show treasury recommendations");
  expect(files.docs.includes("Parte 3"), "[recommendations] documentation must mention pending Part 3");
}

function runMigrationChecks() {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const migration = fs.readFileSync("prisma/migrations/20260711233000_proactive_recommendations/migration.sql", "utf8");
  for (const forbidden of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM", "ALTER TABLE \"Client\"", "ALTER TABLE \"Invoice\"", "ALTER TABLE \"Work\""]) {
    expect(!migration.toUpperCase().includes(forbidden), `[recommendations] migration must not contain ${forbidden}`);
  }
  for (const model of ["BusinessRecommendation", "RecommendationActionLog", "RecommendationPreference"]) {
    expect(schema.includes(`model ${model}`), `[recommendations] missing Prisma model ${model}`);
    expect(migration.includes(`CREATE TABLE \"${model}\"`), `[recommendations] missing migration table ${model}`);
  }
  expect(migration.includes("BusinessRecommendation_fingerprint_key"), "[recommendations] migration must enforce recommendation deduplication");
}

const mode = process.argv[2] ?? "all";
if (mode === "engine" || mode === "all") runEngineChecks();
if (mode === "actions" || mode === "all") runActionChecks();
if (mode === "followup" || mode === "all") runFollowupChecks();
if (mode === "deduplication" || mode === "all") runDedupChecks();
if (mode === "chat" || mode === "all") runChatChecks();
if (mode === "center" || mode === "all") runCenterChecks();
if (mode === "integration" || mode === "all") runIntegrationChecks();
if (mode === "migration" || mode === "all") runMigrationChecks();

console.log(`[recommendations] OK ${mode}`);
