import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/works.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const sandbox = { exports: {}, require, console };
vm.runInNewContext(compiled, sandbox);

const {
  ACTIVE_WORK_STATUSES,
  WORK_STATUS_META,
  getWorkNextAction,
  isActiveWorkStatus,
  isBlockedWorkStatus,
  validWorkPriority,
  validWorkStatus
} = sandbox.exports;

function expect(condition, message, details) {
  if (!condition) {
    console.error("[works] FAIL", message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}

for (const status of ["borrador", "pendiente_aprobacion", "planificada", "preparacion", "en_curso", "pendiente_material", "pendiente_cliente", "parada", "finalizada", "facturada", "cobrada", "archivada"]) {
  expect(WORK_STATUS_META[status], `missing status metadata for ${status}`);
  expect(Array.isArray(WORK_STATUS_META[status].allowedActions), `missing allowed actions for ${status}`);
  expect(WORK_STATUS_META[status].icon, `missing icon for ${status}`);
}

expect(ACTIVE_WORK_STATUSES.includes("preparacion"), "new active state preparacion must be counted active");
expect(isActiveWorkStatus("en_curso") === true, "en_curso must be active");
expect(isActiveWorkStatus("cerrada") === false, "cerrada must not be active");
expect(isBlockedWorkStatus("parada") === true, "parada must be blocked");
expect(validWorkStatus("estado_raro") === "pendiente_inicio", "invalid work status must fallback safely");
expect(validWorkPriority("urgente") === "urgente", "valid priority must be preserved");
expect(validWorkPriority("otra") === "media", "invalid priority must fallback safely");

const materialAction = getWorkNextAction({
  estado: "en_curso",
  materials: [{ nombre: "Plato ducha", estado: "falta" }],
  invoices: [],
  reminders: [],
  agendaEvents: [],
  budgets: [{ estado: "aceptado", total: 1000 }]
});
expect(materialAction.label.includes("Plato ducha"), "next action must prioritize missing material", materialAction);

const invoiceAction = getWorkNextAction({
  estado: "finalizada",
  materials: [],
  invoices: [{ total: 1000, estado: "vencida", fechaVencimiento: new Date("2026-06-01"), payments: [] }],
  reminders: [],
  agendaEvents: [],
  budgets: [{ estado: "aceptado", total: 1000 }]
}, new Date("2026-07-11"));
expect(invoiceAction.tone === "danger", "overdue invoice must be a danger action", invoiceAction);

console.log("[works] OK status metadata, active states and next actions");
