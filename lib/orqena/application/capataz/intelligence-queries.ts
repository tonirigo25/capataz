import { type ChatIntentClassification } from "@/lib/capataz-chat-query";
import { dismissBusinessRecommendation, getBusinessRecommendations, markRecommendationViewed, reactivateBusinessRecommendation, snoozeBusinessRecommendation, snoozeBusinessRecommendationUntil, type BusinessRecommendation } from "@/lib/business-recommendations";
import { getBusinessSignals, type BusinessSignal } from "@/lib/business-signals";
import { getBusinessIntelligenceSummary, metricDefinitionText } from "@/lib/business-intelligence";
import type { BusinessPeriodId } from "@/lib/business-periods";
import { getProactiveControlData } from "@/lib/proactive-evaluation";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { ChatActionResult, ChatCommandContext, ChatCommandResult } from "@/lib/orqena/application/capataz/orchestration";
import { formatDateShort, invoicePeriodWhere, periodText } from "@/lib/orqena/application/capataz/record-queries";
import { addDays, formatDateTime, formatEuros } from "@/lib/orqena/application/capataz/shared-helpers";

export async function queryBusinessMetric(intent: ChatIntentClassification, metric: "invoiced" | "collected" | "outstanding" | "overdue" | "expenses"): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const values = {
    invoiced: { label: "Facturado", value: summary.money.invoiced, definition: metricDefinitionText("invoiced"), href: "/dinero" },
    collected: { label: "Cobrado", value: summary.money.collected, definition: metricDefinitionText("collected"), href: "/dinero" },
    outstanding: { label: "Pendiente de cobro", value: summary.money.outstanding, definition: metricDefinitionText("outstanding"), href: "/dinero?filtro=pendientes" },
    overdue: { label: "Vencido", value: summary.money.overdue, definition: metricDefinitionText("overdue"), href: "/dinero?filtro=vencidas" },
    expenses: { label: "Gastos", value: summary.money.expenses, definition: metricDefinitionText("expenses"), href: "/gastos-materiales" }
  };
  const item = values[metric];
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    result: {
      type: "found",
      entityType: "business_metric",
      title: item.label,
      summary: { periodo: summary.period.label, valor: item.value },
      actions: [{ label: "Ver detalle", href: item.href, style: "primary" }, { label: "Abrir inteligencia", href: businessPanelHref(summary.period.id) }]
    },
    text: `${summary.period.label}: ${item.label.toLowerCase()} ${formatEuros(item.value)}.\n\n${item.definition}`
  };
}

export async function queryBusinessProfit(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  return {
    handled: true,
    diagnostics: { resultCount: 2 },
    text: `${summary.period.label}: beneficio sobre facturado ${formatEuros(summary.money.profitOnInvoiced)} y beneficio sobre cobrado ${formatEuros(summary.money.profitOnCollected)}.\n\nBeneficio es ambiguo: sobre facturado usa facturas emitidas menos gastos; sobre cobrado usa pagos reales menos gastos. ${metricDefinitionText("profit_invoiced")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Beneficio",
      summary: { sobreFacturado: summary.money.profitOnInvoiced, sobreCobrado: summary.money.profitOnCollected },
      actions: [{ label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad`, style: "primary" }]
    }
  };
}

export async function queryBusinessMargin(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  return {
    handled: true,
    diagnostics: { resultCount: 2 },
    text: `${summary.period.label}: margen sobre facturado ${roundForChat(summary.money.marginOnInvoiced)}% y margen sobre cobrado ${roundForChat(summary.money.marginOnCollected)}%.\n\n${metricDefinitionText("margin_invoiced")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Margen",
      summary: { margenFacturado: summary.money.marginOnInvoiced, margenCobrado: summary.money.marginOnCollected },
      actions: [{ label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad`, style: "primary" }]
    }
  };
}

export async function queryBusinessBestWork(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.works.byProfit.find((work) => work.hasEnoughData);
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay datos suficientes para calcular la obra más rentable." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.works.byProfit.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.workId,
      title: "Obra más rentable",
      summary: { obra: top.title, beneficio: top.profitOnInvoiced, margen: top.marginOnInvoiced },
      actions: [{ label: "Ver obra", href: `/obras/${top.workId}`, style: "primary" }, { label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad` }]
    },
    text: `La obra más rentable es ${top.title}, de ${top.clientName}: beneficio sobre facturado ${formatEuros(top.profitOnInvoiced)} y margen ${roundForChat(top.marginOnInvoiced)}%.\n\nRentabilidad de obra = ingresos relacionados con la obra menos gastos relacionados.`
  };
}

export async function queryBusinessClientHighestDebt(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.clients.byDebt[0];
  if (!top || top.debt <= 0) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay clientes con saldo pendiente calculado." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.clients.byDebt.length },
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Cliente con mayor saldo pendiente",
      summary: { cliente: top.name, pendiente: top.debt },
      actions: [{ label: "Ver cliente", href: top.href, style: "primary" }, { label: "Ver facturas", href: "/dinero?filtro=pendientes" }]
    },
    text: `El cliente con mayor saldo pendiente es ${top.name}, con ${formatEuros(top.debt)}. Representa ${roundForChat(top.debtShare)}% del pendiente total.`
  };
}

export async function queryBusinessSlowestClient(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.clients.bySlowestPayment[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas completamente cobradas suficientes para calcular plazo medio de cobro por cliente." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.clients.bySlowestPayment.length },
    text: `${top.name} tiene el mayor plazo medio de cobro calculado: ${roundForChat(top.averageCollectionDays ?? 0)} días. Se calcula entre la fecha de factura y la fecha en que los pagos acumulados cubren su total.`,
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Mayor plazo medio de cobro",
      summary: { cliente: top.name, dias: top.averageCollectionDays },
      actions: [{ label: "Ver cliente", href: top.href, style: "primary" }]
    }
  };
}

export async function queryBusinessQuoteConversion(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const conversion = summary.quotes.conversionRate;
  return {
    handled: true,
    diagnostics: { resultCount: summary.quotes.count },
    text: conversion === null
      ? `${summary.period.label}: no hay presupuestos decididos suficientes para calcular conversión. Aceptados: ${summary.quotes.acceptedCount}, decididos: ${summary.quotes.decidedCount}.`
      : `${summary.period.label}: conversión de presupuestos ${roundForChat(conversion)}%. Aceptados: ${summary.quotes.acceptedCount}; decididos: ${summary.quotes.decidedCount}.\n\n${metricDefinitionText("quote_conversion")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Conversión de presupuestos",
      summary: { conversion, aceptados: summary.quotes.acceptedCount, decididos: summary.quotes.decidedCount },
      actions: [{ label: "Abrir presupuestos", href: "/presupuestos", style: "primary" }]
    }
  };
}

export async function queryBusinessComparison(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const rows = [
    ["Facturado", summary.comparisons.invoiced],
    ["Cobrado", summary.comparisons.collected],
    ["Gastos", summary.comparisons.expenses],
    ["Beneficio", summary.comparisons.profit]
  ] as const;
  return {
    handled: true,
    diagnostics: { resultCount: rows.length },
    text: `${summary.period.label} frente al periodo anterior:\n${rows.map(([label, item]) => `- ${label}: ${formatEuros(item.current)} vs ${item.previous === null ? "sin dato" : formatEuros(item.previous)} (${item.label}).`).join("\n")}\n\nLa semántica de tendencia distingue gastos y vencido como métricas donde subir puede ser negativo.`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Comparativa temporal",
      summary: { periodo: summary.period.label },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    }
  };
}

export async function queryBusinessReviewToday(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const alerts = summary.alerts.slice(0, 5);
  if (!alerts.length) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay avisos relevantes para revisar ahora mismo." };
  return {
    handled: true,
    diagnostics: { resultCount: alerts.length },
    text: `Revisaría esto:\n${alerts.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail} · ${alert.href}`).join("\n")}`,
    result: {
      type: "found",
      entityType: "business",
      title: "Puntos de revisión",
      summary: { alertas: alerts.length },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    }
  };
}

type BusinessSignalsChatMode = "review_today" | "urgent" | "problems" | "risks" | "clients" | "works" | "invoices" | "explain_top" | "critical_count";

export async function queryBusinessSignals(intent: ChatIntentClassification, mode: BusinessSignalsChatMode): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const result = await getBusinessSignals({ companyId, status: "active", limit: 120 });
  const filtered = filterSignalsForChat(result.signals, mode).slice(0, 7);
  const title = signalChatTitle(mode);
  if (mode === "critical_count") {
    const critical = result.signals.filter((signal) => signal.level === "critico");
    return {
      handled: true,
      diagnostics: { resultCount: critical.length },
      result: {
        type: "found",
        entityType: "business",
        title,
        summary: { criticas: critical.length, activas: result.summary.active },
        actions: [{ label: "Abrir alertas", href: "/alertas?nivel=critico", style: "primary" }]
      },
      text: `Tienes ${critical.length} alertas críticas activas. ${critical.length ? `Las principales son:\n${critical.slice(0, 5).map((signal, index) => `${index + 1}. ${signal.title}: ${signal.explanation.why}${signal.entity ? ` · ${signal.entity.href}` : ""}`).join("\n")}` : "No hay alertas críticas activas ahora mismo."}`
    };
  }
  if (mode === "explain_top") {
    const top = result.summary.top;
    if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay alertas activas que explicar ahora mismo." };
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: {
        type: "found",
        entityType: top.entity?.type === "cliente" ? "client" : top.entity?.type === "obra" ? "project" : top.entity?.type === "factura" ? "invoice" : "business",
        entityId: top.entity?.id,
        title: "Explicación de alerta prioritaria",
        summary: { prioridad: top.prioridad, nivel: top.levelText, origen: top.sourceLabel },
        actions: [{ label: "Abrir alertas", href: "/alertas", style: "primary" }]
      },
      text: `${top.title}\n\nMotivo: ${top.explanation.why}\n\nInformación utilizada:\n${top.explanation.dataUsed.map((item) => `- ${item}`).join("\n")}\n\nSi no haces nada: ${top.explanation.consequence}`
    };
  }
  if (!filtered.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title,
        summary: { activas: result.summary.active, criticas: result.summary.critical, importantes: result.summary.important },
        actions: [{ label: "Abrir alertas", href: "/alertas", style: "primary" }]
      },
      text: `No hay señales activas para esa consulta. El centro de alertas tiene ${result.summary.active} señales activas en total.`
    };
  }

  const top = filtered[0];
  const lines = filtered.map((signal, index) => `${index + 1}. ${signal.levelText} · ${signal.title}: ${signal.explanation.why}${signal.entity ? ` · ${signal.entity.href}` : ""}`);
  return {
    handled: true,
    diagnostics: { resultCount: filtered.length },
    result: {
      type: "found",
      entityType: top.entity?.type === "cliente" ? "client" : top.entity?.type === "obra" ? "project" : top.entity?.type === "factura" ? "invoice" : "business",
      entityId: top.entity?.id,
      title,
      summary: {
        señales: filtered.length,
        criticas: filtered.filter((signal) => signal.level === "critico").length,
        importantes: filtered.filter((signal) => signal.level === "importante").length,
        impacto: filtered.reduce((total, signal) => total + (signal.relatedAmount ?? 0), 0)
      },
      actions: [
        { label: "Abrir alertas", href: "/alertas", style: "primary" },
        ...(top.entity ? [{ label: "Abrir prioridad", href: top.entity.href, style: "secondary" as const }] : [])
      ]
    },
    text: `${signalChatIntro(mode, result.summary.active)}

${lines.join("\n")}

Ordenadas por impacto económico, urgencia, riesgo, tiempo y dependencias.`
  };
}

type BusinessRecommendationsChatMode =
  | "today"
  | "first"
  | "quick_wins"
  | "important"
  | "client"
  | "work"
  | "explain_current"
  | "do_current"
  | "snooze_current"
  | "dismiss_current"
  | "change_date_current"
  | "reviewed_at"
  | "reactivated"
  | "resolved_week"
  | "snoozed"
  | "due_today"
  | "history"
  | "noisy_rules"
  | "mark_reviewed_current"
  | "reactivate_current";

export async function queryBusinessRecommendations(intent: ChatIntentClassification, mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (["reviewed_at", "reactivated", "resolved_week", "snoozed", "due_today", "history", "noisy_rules"].includes(mode)) {
    return queryProactiveRecommendationLifecycle(mode);
  }
  if (mode === "explain_current" || mode === "do_current" || mode === "snooze_current" || mode === "dismiss_current" || mode === "change_date_current" || mode === "mark_reviewed_current" || mode === "reactivate_current") {
    return handleCurrentRecommendation(mode, context);
  }

  const params = await recommendationParamsForChat(intent, mode, context);
  const { companyId } = await requireCompanyContext();
  const result = await getBusinessRecommendations({ ...params, companyId, status: "active", limit: mode === "first" ? 5 : 12 });
  const filtered = filterRecommendationsForChat(result.recommendations, mode).slice(0, mode === "first" ? 1 : 6);
  if (!filtered.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title: "Recomendaciones",
        summary: { activas: result.summary.active },
        actions: [{ label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" }]
      },
      text: "No tienes recomendaciones prioritarias para esa consulta ahora mismo."
    };
  }

  const top = filtered[0];
  const lines = filtered.map((recommendation, index) => {
    const action = recommendation.preferredAction ? ` Acción sugerida: ${recommendation.preferredAction.label}.` : "";
    return `${index + 1}. Prioridad ${recommendation.priority} · ${recommendation.title}: ${recommendation.summary}.${action}${recommendation.entityHref ? ` ${recommendation.entityHref}` : ""}`;
  });

  return {
    handled: true,
    diagnostics: { resultCount: filtered.length },
    result: {
      type: "found",
      entityType: top.entityType === "client" ? "client" : top.entityType === "work" ? "project" : top.entityType === "invoice" ? "invoice" : "business",
      entityId: top.entityId ?? undefined,
      title: recommendationChatTitle(mode),
      summary: {
        recomendaciones: filtered.length,
        prioridad: top.priority,
        requiereConfirmacion: top.requiresConfirmation
      },
      actions: [
        { label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" },
        ...(top.entityHref ? [{ label: "Abrir entidad", href: top.entityHref, style: "secondary" as const }] : [])
      ]
    },
    context: withLastRecommendationContext(context, top),
    text: `${recommendationChatIntro(mode, result.summary.active)}

${lines.join("\n")}

He guardado la primera recomendación como contexto. Puedes preguntar "por qué", "recuérdamelo mañana" o "descártalo". Si una acción modifica datos, pediré confirmación.`
  };
}

async function queryProactiveRecommendationLifecycle(mode: BusinessRecommendationsChatMode): Promise<ChatCommandResult> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = addDays(todayStart, 1);

  if (mode === "reviewed_at") {
    const { companyId } = await requireCompanyContext();
    const data = await getProactiveControlData(now, companyId);
    const latest = data.latestRun;
    return {
      handled: true,
      diagnostics: { resultCount: data.runs.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Evaluación proactiva",
        summary: { ejecuciones: data.runs.length, ultima: latest ? formatDateShort(latest.startedAt) : "sin ejecución" },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: latest
        ? `La última revisión fue el ${formatDateTime(latest.startedAt)}. Estado: ${latest.status}. Procesó ${latest.processedSignals} alertas y ${latest.processedRecommendations} recomendaciones.`
        : "Todavía no hay una revisión disponible. Puedes iniciarla desde el centro de recomendaciones."
    };
  }

  if (mode === "noisy_rules") {
    const { companyId } = await requireCompanyContext();
    const data = await getProactiveControlData(now, companyId);
    const lines = data.noisyRules.slice(0, 6).map((rule, index) => `${index + 1}. ${rule.ruleId}: ${rule.warning} (${rule.dismissed}/${rule.total} descartadas).`);
    return {
      handled: true,
      diagnostics: { resultCount: data.noisyRules.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Reglas con ruido",
        summary: { reglas: data.noisyRules.length },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: lines.length
        ? `Reglas con posible ruido:\n\n${lines.join("\n")}\n\nNo he desactivado ninguna regla automáticamente.`
        : "No veo un volumen anómalo de descartes o recomendaciones activas."
    };
  }

  if (mode === "history") {
    const events = await prisma.proactiveAuditEvent.findMany({
      where: { recommendationFingerprint: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8
    });
    const lines = events.map((event, index) => `${index + 1}. ${formatDateTime(event.createdAt)} · ${event.eventType}${event.previousStatus ? ` · ${event.previousStatus} -> ${event.nextStatus ?? "sin cambio"}` : ""}. ${event.reason ?? ""}`.trim());
    return {
      handled: true,
      diagnostics: { resultCount: events.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Historial de recomendaciones",
        summary: { eventos: events.length },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: lines.length ? `Historial reciente de recomendaciones:\n\n${lines.join("\n")}` : "Aún no hay actividad reciente de recomendaciones."
    };
  }

  const params = mode === "snoozed"
    ? { status: "snoozed" as const, limit: 12 }
    : mode === "reactivated"
      ? { status: "all" as const, limit: 80 }
      : { status: "all" as const, limit: 80 };
  const { companyId } = await requireCompanyContext();
  const result = await getBusinessRecommendations({ ...params, companyId });
  let items = result.recommendations;
  if (mode === "reactivated") items = items.filter((item) => item.reactivatedAt).slice(0, 8);
  if (mode === "resolved_week") {
    const weekStart = startOfWeek(now);
    items = items.filter((item) => (item.completedAt && item.completedAt >= weekStart) || item.status === "obsolete").slice(0, 8);
  }
  if (mode === "due_today") {
    items = items.filter((item) =>
      (item.dueAt && item.dueAt >= todayStart && item.dueAt < todayEnd) ||
      (item.snoozedUntil && item.snoozedUntil >= todayStart && item.snoozedUntil < todayEnd)
    ).slice(0, 8);
  }

  const lines = items.map((item, index) => {
    const date = item.reactivatedAt ?? item.snoozedUntil ?? item.completedAt ?? item.dueAt ?? item.updatedAt;
    return `${index + 1}. ${item.statusLabel} · ${item.title} · ${formatDateShort(date)}. ${reactivationReasonForRecommendation(item)}`;
  });

  const titleMap: Partial<Record<BusinessRecommendationsChatMode, string>> = {
    reactivated: "Recomendaciones reactivadas",
    resolved_week: "Resuelto esta semana",
    snoozed: "Recomendaciones pospuestas",
    due_today: "Recomendaciones que vencen hoy"
  };
  const title = titleMap[mode] ?? "Recomendaciones";

  return {
    handled: true,
    diagnostics: { resultCount: items.length },
    result: {
      type: "found",
      entityType: "business",
      title,
      summary: { recomendaciones: items.length },
      actions: [{ label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" }]
    },
    text: lines.length ? `${title}:\n\n${lines.join("\n")}` : `No hay datos para "${title}" ahora mismo.`
  };
}

async function handleCurrentRecommendation(mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const current = await findCurrentRecommendation(context);
  if (!current) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title: "Sin recomendación activa en contexto",
        summary: { requiereContexto: true },
        actions: [{ label: "Ver recomendaciones", href: "/recomendaciones", style: "primary" }]
      },
      text: "Necesito una recomendación concreta. Pregúntame primero qué te recomiendo hacer hoy o abre el centro de recomendaciones."
    };
  }

  if (mode === "explain_current") {
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, current),
      text: `${current.title}

Por qué: ${current.detailedExplanation}

Datos usados:
${current.evidence.dataUsed.map((item) => `- ${item}`).join("\n") || "- Señal activa y entidad relacionada."}

Acción sugerida: ${current.preferredAction?.label ?? "Revisar en el centro"}.
Puedes revisar la propuesta antes de continuar.`
    };
  }

  if (mode === "mark_reviewed_current") {
    await markRecommendationViewed(current.fingerprint);
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, { ...current, status: "viewed", reviewedAt: new Date() }),
      text: `He marcado "${current.title}" como revisada. No la he resuelto: seguirá activa mientras la causa continúe y el cooldown solo reduce su prominencia temporal.`
    };
  }

  if (mode === "reactivate_current") {
    await reactivateBusinessRecommendation(current.fingerprint, "Reactivada desde Orqena por petición explícita.");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, { ...current, status: "active", reactivatedAt: new Date() }),
      text: `He reactivado "${current.title}". No he ejecutado ninguna acción externa ni he modificado facturas, clientes, obras o pagos.`
    };
  }

  if (mode === "do_current") {
    const action = current.preferredAction ?? current.suggestedActions[0];
    if (!action) {
      return { handled: true, diagnostics: { resultCount: 1 }, context: withLastRecommendationContext(context, current), text: "Esta recomendación no tiene una acción directa disponible. Puedes abrir el centro de recomendaciones para revisarla." };
    }
    if (action.requiresConfirmation) {
      return {
        handled: true,
        diagnostics: { resultCount: 1 },
        result: recommendationChatResult(current),
        context: withLastRecommendationContext(context, current),
        text: `Puedo preparar "${action.label}" para esta recomendación, pero requiere confirmación explícita antes de modificar nada.

Vista previa:
${(action.preview ?? []).map((row) => `- ${row.label}: ${row.value}`).join("\n") || `- Recomendación: ${current.title}`}

Confírmalo desde el centro de recomendaciones o dime la acción concreta con todos los datos.`
      };
    }
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, current),
      text: `La siguiente acción es "${action.label}". Puedes abrirla aquí: ${action.href ?? "/recomendaciones"}`
    };
  }

  if (mode === "snooze_current") {
    await snoozeBusinessRecommendation(current.fingerprint, "tomorrow", "Pospuesta desde Orqena");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "snoozed" }),
      text: `He pospuesto "${current.title}" hasta mañana. Solo he cambiado el estado de la recomendación; no he modificado facturas, clientes, obras ni pagos.`
    };
  }

  if (mode === "change_date_current") {
    const friday = nextWeekday(5);
    await snoozeBusinessRecommendationUntil(current.fingerprint, friday, "Reprogramada al viernes desde Orqena");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "snoozed", snoozedUntil: friday }),
      text: `He cambiado el recordatorio de esta recomendación al viernes ${formatDateShort(friday)}. No he creado tareas nuevas ni he modificado entidades de negocio.`
    };
  }

  if (mode === "dismiss_current") {
    await dismissBusinessRecommendation(current.fingerprint, "Descartada desde Orqena");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "dismissed" }),
      text: `He descartado "${current.title}" y lo he dejado registrado en el histórico. No he modificado entidades de negocio.`
    };
  }

  return { handled: false, text: "" };
}

async function recommendationParamsForChat(intent: ChatIntentClassification, mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null) {
  if (mode === "client") {
    const clientId = context?.lastClientId ?? await findClientIdForRecommendation(intent.clientName);
    return clientId ? { clientId } : {};
  }
  if (mode === "work") {
    return context?.lastWorkId ? { workId: context.lastWorkId } : {};
  }
  return {};
}

function filterRecommendationsForChat(recommendations: BusinessRecommendation[], mode: BusinessRecommendationsChatMode) {
  const sorted = [...recommendations].sort((a, b) => b.priority - a.priority || b.score - a.score || (b.amount ?? 0) - (a.amount ?? 0));
  if (mode === "quick_wins") return sorted.filter((recommendation) => !recommendation.requiresConfirmation || ["view_invoice", "view_client", "view_work", "view_treasury"].includes(recommendation.preferredAction?.id ?? ""));
  if (mode === "important") return sorted.filter((recommendation) => ["critico", "importante"].includes(recommendation.level));
  return sorted;
}

async function findCurrentRecommendation(context: ChatCommandContext | null) {
  const fingerprint = context?.lastRecommendation?.fingerprint;
  const { companyId } = await requireCompanyContext();
  const result = await getBusinessRecommendations({ companyId, status: "active", limit: 80 });
  if (fingerprint) {
    const current = result.recommendations.find((recommendation) => recommendation.fingerprint === fingerprint);
    if (current) return current;
  }
  return result.summary.top;
}

function withLastRecommendationContext(context: ChatCommandContext | null, recommendation: BusinessRecommendation): ChatCommandContext {
  return {
    ...(context ?? {}),
    lastRecommendation: {
      recommendationId: recommendation.id,
      fingerprint: recommendation.fingerprint,
      signalFingerprint: recommendation.signalFingerprint,
      entityType: recommendation.entityType,
      entityId: recommendation.entityId,
      actionId: recommendation.preferredAction?.id ?? null,
      shownAt: new Date().toISOString(),
      status: recommendation.status
    },
    lastClientId: recommendation.clientId ?? context?.lastClientId,
    lastWorkId: recommendation.workId ?? context?.lastWorkId,
    lastInvoiceId: recommendation.invoiceId ?? context?.lastInvoiceId,
    lastBudgetId: recommendation.budgetId ?? context?.lastBudgetId
  };
}

function recommendationChatResult(recommendation: BusinessRecommendation): ChatActionResult {
  return {
    type: "found",
    entityType: recommendation.entityType === "client" ? "client" : recommendation.entityType === "work" ? "project" : recommendation.entityType === "invoice" ? "invoice" : "business",
    entityId: recommendation.entityId ?? undefined,
    title: recommendation.title,
    summary: {
      prioridad: recommendation.priority,
      nivel: recommendation.levelText,
      accion: recommendation.preferredAction?.label ?? "Revisar",
      requiereConfirmacion: recommendation.requiresConfirmation
    },
    actions: [
      { label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" },
      ...(recommendation.entityHref ? [{ label: "Abrir entidad", href: recommendation.entityHref, style: "secondary" as const }] : [])
    ]
  };
}

async function findClientIdForRecommendation(clientName: string | undefined) {
  if (!clientName) return undefined;
  const { companyId } = await requireCompanyContext();
  const client = await prisma.client.findFirst({
    where: { companyId, nombre: { contains: clientName, mode: "insensitive" } },
    select: { id: true }
  });
  return client?.id;
}

function recommendationChatTitle(mode: BusinessRecommendationsChatMode) {
  const labels: Record<BusinessRecommendationsChatMode, string> = {
    today: "Recomendaciones para hoy",
    first: "Siguiente mejor acción",
    quick_wins: "Acciones rápidas",
    important: "Recomendaciones importantes",
    client: "Recomendaciones del cliente",
    work: "Recomendaciones de obra",
    explain_current: "Explicación de recomendación",
    do_current: "Confirmación de recomendación",
    snooze_current: "Posponer recomendación",
    dismiss_current: "Descartar recomendación",
    change_date_current: "Cambiar fecha de recomendación",
    reviewed_at: "Evaluaciones proactivas",
    reactivated: "Recomendaciones reactivadas",
    resolved_week: "Resuelto esta semana",
    snoozed: "Recomendaciones pospuestas",
    due_today: "Recomendaciones que vencen hoy",
    history: "Historial de recomendaciones",
    noisy_rules: "Reglas con ruido",
    mark_reviewed_current: "Marcar revisada",
    reactivate_current: "Reactivar recomendación"
  };
  return labels[mode];
}

function recommendationChatIntro(mode: BusinessRecommendationsChatMode, activeCount: number) {
  const base = `He revisado ${activeCount} recomendaciones activas derivadas de señales reales.`;
  if (mode === "first") return `${base} Haría primero:`;
  if (mode === "quick_wins") return `${base} Lo más rápido de resolver es:`;
  if (mode === "important") return `${base} Las importantes son:`;
  if (mode === "client") return `${base} Para este cliente revisaría:`;
  if (mode === "work") return `${base} Para esta obra revisaría:`;
  return `${base} Recomiendo:`;
}

function reactivationReasonForRecommendation(recommendation: BusinessRecommendation) {
  if (recommendation.reactivatedAt && recommendation.snoozedUntil && recommendation.snoozedUntil <= new Date()) {
    return "Ha vuelto a aparecer porque terminó el aplazamiento y la causa sigue activa.";
  }
  if (recommendation.reactivatedAt) {
    return recommendation.outcome?.message ?? "Se reactivó por cambio material o porque volvió la condición.";
  }
  if (recommendation.status === "snoozed" && recommendation.snoozedUntil) {
    return `Volverá si la causa sigue activa al terminar el aplazamiento.`;
  }
  if (recommendation.status === "obsolete") {
    return recommendation.outcome?.message ?? "Quedó obsoleta porque la señal origen ya no está activa.";
  }
  return recommendation.detailedExplanation;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

function nextWeekday(day: number) {
  const date = new Date();
  const diff = (day + 7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(9, 0, 0, 0);
  return date;
}

function filterSignalsForChat(signals: BusinessSignal[], mode: BusinessSignalsChatMode) {
  const sorted = [...signals].sort((a, b) => b.score - a.score || (b.relatedAmount ?? 0) - (a.relatedAmount ?? 0));
  if (mode === "urgent") return sorted.filter((signal) => ["critico", "importante"].includes(signal.level));
  if (mode === "problems") return sorted.filter((signal) => signal.level !== "info");
  if (mode === "risks") return sorted.filter((signal) => ["critico", "importante"].includes(signal.level) || ["cobros", "tesoreria", "rentabilidad", "obras", "gastos"].includes(signal.source));
  if (mode === "clients") return sorted.filter((signal) => signal.client || signal.entity?.type === "cliente");
  if (mode === "works") return sorted.filter((signal) => signal.work || signal.entity?.type === "obra" || signal.type.startsWith("work_") || signal.type.includes("materials"));
  if (mode === "invoices") return sorted.filter((signal) => signal.entity?.type === "factura" || signal.type.includes("invoice") || ["facturas", "cobros"].includes(signal.source));
  if (mode === "critical_count") return sorted.filter((signal) => signal.level === "critico");
  return sorted;
}

function signalChatTitle(mode: BusinessSignalsChatMode) {
  const labels: Record<BusinessSignalsChatMode, string> = {
    review_today: "Qué revisar hoy",
    urgent: "Lo más urgente",
    problems: "Problemas detectados",
    risks: "Riesgos importantes",
    clients: "Clientes que requieren atención",
    works: "Obras que revisar",
    invoices: "Facturas prioritarias",
    explain_top: "Explicación de alerta",
    critical_count: "Alertas críticas"
  };
  return labels[mode];
}

function signalChatIntro(mode: BusinessSignalsChatMode, activeCount: number) {
  const base = `He revisado ${activeCount} prioridades activas.`;
  if (mode === "urgent") return `${base} Lo más urgente ahora es:`;
  if (mode === "clients") return `${base} Clientes con más atención operativa:`;
  if (mode === "works") return `${base} Obras que conviene revisar:`;
  if (mode === "invoices") return `${base} Facturas prioritarias:`;
  if (mode === "risks") return `${base} Riesgos importantes detectados:`;
  if (mode === "problems") return `${base} Problemas principales:`;
  if (mode === "explain_top") return `${base} Explicación de la alerta prioritaria:`;
  if (mode === "critical_count") return `${base} Alertas críticas:`;
  return `${base} Revisaría esto hoy:`;
}

export async function businessSummary(intent: ChatIntentClassification) {
  const { companyId } = await requireCompanyContext();
  return getBusinessIntelligenceSummary({ companyId, period: businessPeriodForIntent(intent.period) });
}

function businessPeriodForIntent(period: ChatIntentClassification["period"]): BusinessPeriodId {
  if (period === "this_week") return "this_week";
  if (period === "this_month") return "this_month";
  if (period === "last_month") return "previous_month";
  if (period === "this_year") return "this_year";
  return "this_month";
}

export function businessPanelHref(periodId: BusinessPeriodId) {
  return `/inteligencia?periodo=${periodId}`;
}

export function roundForChat(value: number | null | undefined) {
  return Math.round((value ?? 0) * 10) / 10;
}

async function queryRevenueSummary(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const where = { companyId, ...invoicePeriodWhere(intent.period) };
  const invoices = await prisma.invoice.findMany({ where, select: { total: true, pagado: true, pendiente: true } });
  const total = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.pagado, 0);
  const pending = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  return {
    handled: true,
    text: invoices.length
      ? `${periodText(intent.period, "facturación")}: ${formatEuros(total)} facturados en ${invoices.length} facturas. Cobrado: ${formatEuros(paid)}. Pendiente: ${formatEuros(pending)}.`
      : `${periodText(intent.period, "facturación")}: no hay facturas registradas.`
  };
}

// Retained for deterministic query compatibility.
void queryRevenueSummary;
