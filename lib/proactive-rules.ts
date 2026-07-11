import type { BusinessSignalLevel } from "@prisma/client";

export type ProactiveRulePolicy = {
  cooldownDays: number;
  expiresAfterDays?: number;
  materialPriorityDelta: number;
  description: string;
};

const DEFAULT_POLICY: ProactiveRulePolicy = {
  cooldownDays: 7,
  materialPriorityDelta: 15,
  description: "Política general: reactivar por cambio material de prioridad, versión de regla o entidad relacionada."
};

const RULE_POLICIES: Record<string, ProactiveRulePolicy> = {
  invoice_overdue: {
    cooldownDays: 3,
    materialPriorityDelta: 10,
    description: "Factura: cambia por antigüedad relevante, importe pendiente, pago, vencimiento o estado."
  },
  invoice_due_soon: {
    cooldownDays: 2,
    expiresAfterDays: 7,
    materialPriorityDelta: 10,
    description: "Factura próxima: caduca al pasar vencimiento o cambiar el estado de cobro."
  },
  client_debt_concentration: {
    cooldownDays: 5,
    materialPriorityDelta: 12,
    description: "Cliente: cambia por deuda pendiente, concentración, nuevos vencidos o pagos registrados."
  },
  budget_stalled: {
    cooldownDays: 7,
    expiresAfterDays: 21,
    materialPriorityDelta: 12,
    description: "Presupuesto: cambia por estado, seguimiento, aceptación, rechazo o caducidad."
  },
  work_blocked: {
    cooldownDays: 7,
    materialPriorityDelta: 12,
    description: "Obra: cambia por estado, actividad, fecha, margen o bloqueo operativo."
  },
  work_no_activity: {
    cooldownDays: 7,
    materialPriorityDelta: 12,
    description: "Obra sin actividad: no se repite a diario salvo empeoramiento o nueva actividad."
  },
  work_low_margin: {
    cooldownDays: 7,
    materialPriorityDelta: 10,
    description: "Rentabilidad: cambia por margen, gasto real, coste previsto o presupuesto aprobado."
  },
  work_cost_deviation: {
    cooldownDays: 7,
    materialPriorityDelta: 10,
    description: "Costes: cambia por gasto, desviación, margen y clasificación de costes."
  },
  materials_pending: {
    cooldownDays: 7,
    materialPriorityDelta: 12,
    description: "Materiales: cambia por estado de material o actividad de obra."
  },
  reminder_overdue: {
    cooldownDays: 2,
    materialPriorityDelta: 8,
    description: "Recordatorio: cambia por fecha, estado, finalización o entidad vinculada."
  },
  agenda_event_overdue: {
    cooldownDays: 2,
    materialPriorityDelta: 8,
    description: "Agenda: cambia por fecha, estado, confirmación o reprogramación."
  },
  document_incomplete: {
    cooldownDays: 14,
    materialPriorityDelta: 15,
    description: "Documento: cambia cuando se vincula archivo, entidad o categoría útil."
  },
  client_data_incomplete: {
    cooldownDays: 14,
    materialPriorityDelta: 15,
    description: "Datos: cambia cuando se completa CIF/NIF, contacto, dirección o datos fiscales."
  },
  treasury_negative_cash: {
    cooldownDays: 1,
    materialPriorityDelta: 8,
    description: "Tesorería: cambia por saldo, forecast, déficit, pagos o cobros previstos."
  },
  treasury_data_quality: {
    cooldownDays: 14,
    materialPriorityDelta: 15,
    description: "Tesorería/datos: cambia por conteo de incidencias o entidad corregida."
  }
};

export function proactiveRulePolicy(ruleId: string | null | undefined): ProactiveRulePolicy {
  if (!ruleId) return DEFAULT_POLICY;
  return RULE_POLICIES[ruleId] ?? RULE_POLICIES[ruleId.replace(/^recommendation:/, "")] ?? DEFAULT_POLICY;
}

export function cooldownUntilForRule(ruleId: string | null | undefined, level: BusinessSignalLevel | null | undefined, now = new Date()) {
  const policy = proactiveRulePolicy(ruleId);
  const days = level === "critico" ? Math.min(policy.cooldownDays, 1) : policy.cooldownDays;
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  until.setHours(9, 0, 0, 0);
  return until;
}

export function materialChangeExceeded({
  previousPriority,
  nextPriority,
  previousRuleVersion,
  nextRuleVersion,
  previousHash,
  nextHash,
  ruleId
}: {
  previousPriority?: number | null;
  nextPriority: number;
  previousRuleVersion?: string | null;
  nextRuleVersion?: string | null;
  previousHash?: string | null;
  nextHash?: string | null;
  ruleId?: string | null;
}) {
  const policy = proactiveRulePolicy(ruleId);
  const priorityDelta = nextPriority - (previousPriority ?? nextPriority);
  const ruleChanged = Boolean(previousRuleVersion && nextRuleVersion && previousRuleVersion !== nextRuleVersion);
  const hashChanged = Boolean(previousHash && nextHash && previousHash !== nextHash);
  return ruleChanged || priorityDelta >= policy.materialPriorityDelta || (hashChanged && priorityDelta >= Math.max(5, Math.floor(policy.materialPriorityDelta / 2)));
}

export function materialChangeExplanation({
  previousPriority,
  nextPriority,
  previousHash,
  nextHash,
  ruleId
}: {
  previousPriority?: number | null;
  nextPriority: number;
  previousHash?: string | null;
  nextHash?: string | null;
  ruleId?: string | null;
}) {
  const policy = proactiveRulePolicy(ruleId);
  const delta = nextPriority - (previousPriority ?? nextPriority);
  if (delta > 0) return `La prioridad subió de ${previousPriority ?? "sin dato"} a ${nextPriority}. ${policy.description}`;
  if (previousHash && nextHash && previousHash !== nextHash) return `Cambió la condición material. ${policy.description}`;
  return policy.description;
}

export function stableMaterialHash(value: unknown) {
  const stable = JSON.stringify(sortStable(value));
  let hash = 5381;
  for (let index = 0; index < stable.length; index += 1) {
    hash = ((hash << 5) + hash) + stable.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

function sortStable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sortStable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["createdAt", "updatedAt", "shownAt", "lastDetectedAt", "lastEvaluatedAt"].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortStable(item)])
  );
}
