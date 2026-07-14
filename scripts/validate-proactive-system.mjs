import fs from "node:fs";
import { expect, loadTsModule } from "./ts-test-loader.mjs";

const mode = process.argv[2] ?? "all";
const NOW = new Date("2026-07-11T10:00:00.000Z");

const prismaMock = { prisma: {} };
const businessSignalMocks = {
  formatSignalLevel(level) {
    return { info: "INFO", atencion: "ATENCION", importante: "IMPORTANTE", critico: "CRITICO" }[level] ?? level;
  },
  signalSourceLabel(source) {
    return source;
  },
  signalLevelRank(level) {
    return { info: 1, atencion: 2, importante: 3, critico: 4 }[level] ?? 0;
  },
  resolveSnoozeUntil(preset, now = NOW) {
    const date = new Date(now);
    date.setDate(date.getDate() + (preset === "week" ? 7 : preset === "month" ? 30 : 1));
    return date;
  },
  async getBusinessSignals() {
    return { signals: [], summary: { active: 0, top: null }, generatedAt: NOW };
  }
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function proactiveRules() {
  return loadTsModule("lib/proactive-rules.ts");
}

function businessSignals() {
  return loadTsModule("lib/business-signals.ts", {
    aliases: {
      "@/lib/works": "lib/works.ts",
      "@/lib/business-metrics": "lib/business-metrics.ts",
      "@/lib/proactive-rules": "lib/proactive-rules.ts",
      "@/lib/proactive-audit": "lib/proactive-audit.ts"
    },
    mocks: {
      "@/lib/prisma": prismaMock,
      "@/lib/treasury": { getTreasuryOverview: async () => ({ alerts: [], qualityIssues: [] }) }
    }
  });
}

function businessRecommendations() {
  return loadTsModule("lib/business-recommendations.ts", {
    mocks: {
      "@/lib/business-signals": businessSignalMocks,
      "@/lib/prisma": prismaMock,
      "@/lib/proactive-audit": { logProactiveAuditEvent: async () => undefined },
      "@/lib/proactive-rules": proactiveRules()
    },
    aliases: {
      "@/lib/recommendation-actions": "lib/recommendation-actions.ts",
      "@/lib/format": "lib/format.ts"
    }
  });
}

function runEvaluationChecks() {
  const source = read("lib/proactive-evaluation.ts");
  expect(source.includes("runProactiveEvaluation"), "[proactive] missing central evaluation runner");
  expect(source.includes("getBusinessSignals") && source.includes("getBusinessRecommendations"), "[proactive] evaluation must recalculate signals and recommendations");
  expect(source.includes("snapshotProactiveState") && source.includes("diffSnapshots"), "[proactive] evaluation must compare before/after state");
  expect(source.includes("recordRuleExecutions"), "[proactive] evaluation must record rule executions");
  expect(source.includes("reevaluateProactiveAfterMutation"), "[proactive] mutation hook missing");
  const endpoint = read("app/api/internal/proactive-evaluate/route.ts");
  expect(endpoint.includes("export async function POST"), "[proactive] endpoint must be POST");
  expect(endpoint.includes("x-capataz-cron-secret") && endpoint.includes("PROACTIVE_CRON_SECRET"), "[proactive] endpoint must require server-side secret");
  expect(!endpoint.includes("export async function GET"), "[proactive] endpoint must not expose GET executor");
}

function runSignalLifecycleChecks() {
  const schema = read("prisma/schema.prisma");
  for (const field of ["reviewedAt", "reactivatedAt", "lastEvaluatedAt", "cooldownUntil", "changeHash"]) {
    expect(schema.includes(field), `[proactive] BusinessSignalState missing ${field}`);
  }
  const signals = businessSignals();
  expect(signals.previewCurrentSignalStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-12T10:00:00.000Z"), now: NOW }) === "snoozed", "[proactive] signal snooze must hold");
  expect(signals.previewCurrentSignalStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-10T10:00:00.000Z"), now: NOW }) === "active", "[proactive] signal snooze must reactivate");
  expect(signals.previewCurrentSignalStatusForTest({ status: "dismissed", lastPriority: 70, signalPriority: 72, now: NOW }) === "dismissed", "[proactive] dismissed signal must not return without material change");
  expect(signals.previewCurrentSignalStatusForTest({ status: "dismissed", lastPriority: 40, signalPriority: 80, now: NOW }) === "active", "[proactive] dismissed signal must reactivate after material change");
  expect(signals.previewMissingSignalStatusForTest({ expiresAt: new Date("2026-07-10T10:00:00.000Z"), now: NOW }) === "expired", "[proactive] temporal missing signal must expire");
}

function runRecommendationLifecycleChecks() {
  const schema = read("prisma/schema.prisma");
  for (const field of ["viewedAt", "reviewedAt", "reactivatedAt", "lastEvaluatedAt", "cooldownUntil", "changeHash"]) {
    expect(schema.includes(field), `[proactive] BusinessRecommendation missing ${field}`);
  }
  const recommendations = businessRecommendations();
  expect(recommendations.previewRecommendationStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-12T10:00:00.000Z"), now: NOW }) === "snoozed", "[proactive] recommendation snooze must hold");
  expect(recommendations.previewRecommendationStatusForTest({ status: "snoozed", snoozedUntil: new Date("2026-07-10T10:00:00.000Z"), now: NOW }) === "active", "[proactive] recommendation snooze must reactivate");
  expect(recommendations.previewRecommendationStatusForTest({ status: "dismissed", lastPriority: 60, priority: 64, now: NOW }) === "dismissed", "[proactive] dismissed recommendation must not return without material change");
  expect(recommendations.previewRecommendationStatusForTest({ status: "dismissed", lastPriority: 60, priority: 90, now: NOW }) === "active", "[proactive] dismissed recommendation must reactivate on material change");
  expect(recommendations.previewRecommendationStatusForTest({ status: "completed", lastPriority: 60, priority: 62, changeHash: "a", nextChangeHash: "a", now: NOW }) === "completed", "[proactive] completed recommendation must stay completed without new occurrence");
  expect(recommendations.previewRecommendationStatusForTest({ status: "failed", now: NOW }) === "failed", "[proactive] failed recommendation remains retryable");
}

function runSchedulerChecks() {
  const endpoint = read("app/api/internal/proactive-evaluate/route.ts");
  const railway = read("railway.json");
  const docs = fs.existsSync("docs/BLOQUE_3_SISTEMA_PROACTIVO_CIERRE.md") ? read("docs/BLOQUE_3_SISTEMA_PROACTIVO_CIERRE.md") : "";
  expect(endpoint.includes("railway_cron"), "[proactive] scheduler endpoint must identify the Railway cron trigger");
  expect(railway.includes("preDeployCommand") && railway.includes("npm run db:deploy"), "[proactive] Railway must deploy migrations before start");
  expect(docs.includes("cron") || docs.includes("Cron"), "[proactive] documentation must cover cron limitation/configuration");
}

function runLockingChecks() {
  const migration = read("prisma/migrations/20260712093000_proactive_system_finalization/migration.sql");
  const source = read("lib/proactive-evaluation.ts");
  expect(migration.includes("ProactiveEvaluationRun_running_lock_key"), "[proactive] migration must enforce running lock");
  expect(source.includes("recoverStaleLocks"), "[proactive] lock recovery missing");
  expect(source.includes("LOCK_TIMEOUT_MS"), "[proactive] lock timeout missing");
  expect(source.includes("P2002"), "[proactive] concurrent run must be handled");
}

function runCooldownChecks() {
  const rules = proactiveRules();
  const invoice = rules.cooldownUntilForRule("invoice_overdue", "importante", NOW);
  const critical = rules.cooldownUntilForRule("treasury_negative_cash", "critico", NOW);
  expect(invoice > NOW, "[proactive] cooldown must be in the future");
  expect(critical > NOW, "[proactive] critical cooldown must be in the future");
  expect(rules.materialChangeExceeded({ previousPriority: 50, nextPriority: 80, ruleId: "invoice_overdue" }), "[proactive] material priority delta should reactivate");
  expect(!rules.materialChangeExceeded({ previousPriority: 50, nextPriority: 52, ruleId: "invoice_overdue" }), "[proactive] small priority delta should not reactivate");
}

function runAuditChecks() {
  const schema = read("prisma/schema.prisma");
  const audit = read("lib/proactive-audit.ts");
  for (const model of ["ProactiveAuditEvent", "ProactiveEvaluationRun", "ProactiveRuleExecution"]) {
    expect(schema.includes(`model ${model}`), `[proactive] schema missing ${model}`);
  }
  expect(audit.includes("sanitizeAuditPayload") && audit.includes("[redacted]"), "[proactive] audit must sanitize payloads");
  expect(audit.includes("DATABASE_URL") && audit.includes("OPENAI_API_KEY"), "[proactive] audit must redact known secrets");
}

function runMaintenanceChecks() {
  const source = read("lib/proactive-evaluation.ts");
  expect(source.includes("getProactiveDailySummary"), "[proactive] daily summary missing");
  expect(source.includes("getProactiveWeeklySummary"), "[proactive] weekly summary missing");
  expect(source.includes("detectNoisyRules"), "[proactive] noise detection missing");
  expect(source.includes("ensureDefaultProactiveSettings"), "[proactive] default preferences missing");
  expect(!source.includes("sendEmail") && !source.includes("whatsapp"), "[proactive] maintenance must not send external communications");
}

function runChatChecks() {
  const { classifyChatIntent } = loadTsModule("lib/capataz-chat-query.ts");
  const cases = [
    ["cuándo se revisaron las recomendaciones", "recommendations_reviewed_at"],
    ["qué recomendaciones se reactivaron", "recommendations_reactivated"],
    ["qué quedó resuelto esta semana", "recommendations_resolved_week"],
    ["qué recomendaciones tengo pospuestas", "recommendations_snoozed"],
    ["qué recomendaciones vencen hoy", "recommendations_due_today"],
    ["muéstrame el historial de recomendaciones", "recommendations_history"],
    ["qué reglas generan más avisos", "recommendations_noisy_rules"],
    ["marca esta recomendación como revisada", "recommendations_mark_reviewed"],
    ["reactívala", "recommendations_reactivate_current"]
  ];
  for (const [text, action] of cases) {
    const result = classifyChatIntent(text);
    expect(result.action === action, `[proactive] bad chat classification for ${text}`, result);
  }
  const actions = read("app/(app)/capataz/actions.ts");
  for (const [, action] of cases) {
    expect(actions.includes(`case "${action}"`), `[proactive] missing chat case ${action}`);
  }
  expect(actions.includes("No he cambiado ningún registro"), "[proactive] chat query must avoid mutation");
}

function runIntegrationChecks() {
  const pkg = read("package.json");
  const page = read("app/(app)/recomendaciones/control/page.tsx");
  const recPage = read("app/(app)/recomendaciones/page.tsx");
  const today = read("app/(app)/hoy/page.tsx");
  const migration = read("prisma/migrations/20260712093000_proactive_system_finalization/migration.sql");
  for (const script of [
    "test:proactive-evaluation",
    "test:signal-lifecycle",
    "test:recommendation-lifecycle",
    "test:proactive-scheduler",
    "test:proactive-locking",
    "test:proactive-cooldown",
    "test:proactive-reactivation",
    "test:proactive-audit",
    "test:proactive-maintenance",
    "test:proactive-chat",
    "test:proactive-integration"
  ]) {
    expect(pkg.includes(`"${script}"`), `[proactive] package missing ${script}`);
  }
  expect(page.includes("Centro de control") && page.includes("Evaluar ahora"), "[proactive] control center missing manual evaluation");
  expect(recPage.includes("Historial") && recPage.includes("getProactiveAuditEventsForRecommendations"), "[proactive] recommendation center must show history");
  expect(!today.includes("getProactiveDailySummary"), "[proactive] Hoy must keep proactive daily summary blocked during recovery");
  for (const forbidden of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM"]) {
    expect(!migration.toUpperCase().includes(forbidden), `[proactive] migration must not include ${forbidden}`);
  }
}

if (mode === "evaluation" || mode === "all") runEvaluationChecks();
if (mode === "signal-lifecycle" || mode === "all") runSignalLifecycleChecks();
if (mode === "recommendation-lifecycle" || mode === "all") runRecommendationLifecycleChecks();
if (mode === "scheduler" || mode === "all") runSchedulerChecks();
if (mode === "locking" || mode === "all") runLockingChecks();
if (mode === "cooldown" || mode === "all") runCooldownChecks();
if (mode === "reactivation" || mode === "all") {
  runSignalLifecycleChecks();
  runRecommendationLifecycleChecks();
}
if (mode === "audit" || mode === "all") runAuditChecks();
if (mode === "maintenance" || mode === "all") runMaintenanceChecks();
if (mode === "chat" || mode === "all") runChatChecks();
if (mode === "integration" || mode === "all") runIntegrationChecks();

console.log(`[proactive] OK ${mode}`);
