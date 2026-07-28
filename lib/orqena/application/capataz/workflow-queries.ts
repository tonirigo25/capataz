import { normalizeQueryText, type ChatIntentClassification, type PendingDetailCategory } from "@/lib/capataz-chat-query";
import type { WorkStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTask, changeTaskStatus } from "@/lib/tasks/task-engine";
import { createFollowUp, addFollowUpAttempt } from "@/lib/followups/followup-engine";
import { ACTIVE_WORK_STATUSES } from "@/lib/works";
import { requireCompanyContext } from "@/lib/auth/session";
import { ChatCommandContext, ChatCommandResult } from "@/lib/orqena/application/capataz/orchestration";
import { budgetPeriodWhere, budgetQueryCard, clientForQuery, clientLooksIncomplete, compactListResult, findOpenInvoiceBalances, formatDateShort, noClientResult, pendingCountLabel, startOfDay, withPendingDetailLastQuery } from "@/lib/orqena/application/capataz/record-queries";
import { formatEuros, latestDocumentContext } from "@/lib/orqena/application/capataz/shared-helpers";

async function runExplicitWorkflowMutation(text:string,normalized:string,context:ChatCommandContext|null):Promise<ChatCommandResult|null>{
  const {companyId}=await requireCompanyContext();
  const shownAt=new Date().toISOString();
  if(/^(crea|crear) una tarea\b/.test(normalized)){const title=text.replace(/^.*?tarea\s+(para\s+)?/i,"").trim();if(!title)return null;const dueAt=/mañana|manana/.test(normalized)?tomorrowAt(10):undefined;const task=await createTask({companyId,title,dueAt,origin:"chat",clientId:context?.lastClientId,workId:context?.lastWorkId,budgetId:context?.lastBudgetId,invoiceId:context?.lastInvoiceId});return mutationResult(`He creado la tarea “${task.title}”.`,context,"task",task.id,"Tarea creada","/tareas",{lastTask:{taskId:task.id,action:"created",shownAt}})}
  if(/^(crea|crear) un seguimiento\b/.test(normalized)){const title=text.replace(/^.*?seguimiento\s+(para\s+)?/i,"").trim();if(!title)return null;const days=Number(normalized.match(/en (\d+) dias?/)?.[1]??0);const nextActionAt=days?new Date(Date.now()+days*86400000):undefined;const item=await createFollowUp({companyId,title,nextActionAt,origin:"chat",clientId:context?.lastClientId,workId:context?.lastWorkId,budgetId:context?.lastBudgetId,invoiceId:context?.lastInvoiceId});return mutationResult(`He creado el seguimiento “${item.title}”.`,context,"followup",item.id,"Seguimiento creado","/seguimientos",{lastFollowUp:{followUpId:item.id,action:"created",shownAt}})}
  if(/^(anota|registra) que no respondio/.test(normalized)){if(!context?.lastFollowUp)return clarification("¿En qué seguimiento debo registrar que no respondió?",context);const attempt=await addFollowUpAttempt(context.lastFollowUp.followUpId,{channel:"internal",summary:"No respondió",nextActionAt:new Date(Date.now()+3*86400000)});return mutationResult("He registrado el intento interno. No se ha enviado ninguna comunicación.",context,"followup",context.lastFollowUp.followUpId,"Intento registrado","/seguimientos",{lastFollowUp:{...context.lastFollowUp,attemptId:attempt.id,action:"attempt",shownAt}})}
  if(/(marca|completa|complétala|completala).*tarea|^completala$/.test(normalized)){if(!context?.lastTask)return clarification("¿Qué tarea quieres completar?",context);await changeTaskStatus(context.lastTask.taskId,"completed","chat","Orden explícita desde chat");return mutationResult("He completado la tarea indicada.",context,"task",context.lastTask.taskId,"Tarea completada","/tareas",{lastTask:{...context.lastTask,action:"completed",shownAt}})}
  if(/^(pausala|páusala|pausa esta automatizacion|pausa esta automatización)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres pausar?",context);const changed=await prisma.automationDefinition.updateMany({where:{id:context.lastAutomation.automationId,companyId},data:{active:false,status:"paused"}});if(changed.count!==1)return clarification("No encuentro esa automatización en la empresa activa.",context);return mutationResult("He pausado la automatización.",context,"automation",context.lastAutomation.automationId,"Automatización pausada","/automatizaciones",{lastAutomation:{...context.lastAutomation,action:"paused",shownAt}})}
  if(/^(reanúdala|reanudala|reanuda esta automatizacion|reanuda esta automatización)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres reanudar?",context);const changed=await prisma.automationDefinition.updateMany({where:{id:context.lastAutomation.automationId,companyId},data:{active:true,status:"active"}});if(changed.count!==1)return clarification("No encuentro esa automatización en la empresa activa.",context);return mutationResult("He reanudado la automatización.",context,"automation",context.lastAutomation.automationId,"Automatización activa","/automatizaciones",{lastAutomation:{...context.lastAutomation,action:"resumed",shownAt}})}
  if(/^(ejecutala en seco|ejecútala en seco)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres ejecutar en seco?",context);const owned=await prisma.automationDefinition.findFirst({where:{id:context.lastAutomation.automationId,companyId},select:{id:true}});if(!owned)return clarification("No encuentro esa automatización en la empresa activa.",context);const {runAutomation}=await import("@/lib/automations/automation-runner");const run=await runAutomation({definitionId:owned.id,idempotencyKey:`chat:dry-run:${owned.id}:${Date.now()}`,triggerType:"manual",triggeredBy:"chat",dryRun:true});return mutationResult(`Dry run completado con estado ${run.status}.`,context,"automation",run.automationDefinitionId,"Dry run","/automatizaciones",{lastAutomation:{automationId:run.automationDefinitionId,versionId:run.automationVersionId,runId:run.id,action:"dry_run",shownAt}})}
  return null;
}

// Retained for deterministic workflow compatibility; public chat is proposal-first.
void runExplicitWorkflowMutation;

const tomorrowAt=(hour:number)=>{const date=new Date();date.setDate(date.getDate()+1);date.setHours(hour,0,0,0);return date};

function clarification(text:string,context:ChatCommandContext|null):ChatCommandResult{return{handled:true,context,text}}

function mutationResult(text:string,context:ChatCommandContext|null,entityType:"task"|"followup"|"automation",entityId:string,title:string,href:string,extra:Partial<ChatCommandContext>):ChatCommandResult{return{handled:true,context:{...(context??{}),...extra},text,result:{type:"created",entityType,entityId,title,summary:{ok:true},actions:[{label:"Abrir",href}]}}}

export async function queryAutomations(action: string, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const now=new Date();
  if(action==="automations_failed"){const runs=await prisma.automationRun.findMany({where:{companyId,status:"failed"},include:{definition:true},orderBy:{startedAt:"desc"},take:5});return queryResult(runs.length?`${runs.length} ejecuciones fallidas:\n${runs.map(r=>`- ${r.definition.name}: ${r.errorSummary??r.lastErrorSummary??"falló"}`).join("\n")}`:"No hay ejecuciones fallidas.",context,"automation",runs[0]?.automationDefinitionId,"Automatizaciones fallidas","/automatizaciones",runs.map(r=>r.id),runs[0]?{lastAutomation:{automationId:runs[0].automationDefinitionId,versionId:runs[0].automationVersionId,runId:runs[0].id,action:"failed",shownAt:now.toISOString()}}:{});}
  if(action==="automations_last_run"){const run=await prisma.automationRun.findFirst({where:{companyId},include:{definition:true,steps:true},orderBy:{startedAt:"desc"}});return queryResult(run?`${run.definition.name}: ${run.status}; ${run.steps.filter(s=>s.status==="completed").length}/${run.steps.length} pasos completados.`:"Todavía no hay ejecuciones.",context,"automation",run?.automationDefinitionId,"Última ejecución","/automatizaciones",run?[run.id]:[],run?{lastAutomation:{automationId:run.automationDefinitionId,versionId:run.automationVersionId,runId:run.id,action:"shown",shownAt:now.toISOString()}}:{});}
  if(action==="automations_next"){const schedule=await prisma.automationSchedule.findFirst({where:{active:true,nextRunAt:{gte:now},definition:{companyId}},include:{definition:true},orderBy:{nextRunAt:"asc"}});return queryResult(schedule?`${schedule.definition.name} se ejecutará ${schedule.nextRunAt?.toLocaleString("es-ES")}.`:"No hay una próxima automatización programada.",context,"automation",schedule?.automationDefinitionId,"Próxima automatización","/automatizaciones",schedule?[schedule.id]:[],{});}
  const status=action==="automations_active"?{active:true}:action==="automations_paused"?{status:"paused" as const}:{};const items=await prisma.automationDefinition.findMany({where:{companyId,...status,archivedAt:null},orderBy:{updatedAt:"desc"},take:10});return queryResult(items.length?`${items.length} automatizaciones:\n${items.map(i=>`- ${i.name} · ${i.status}`).join("\n")}`:"No hay automatizaciones con ese estado.",context,"automation",items[0]?.id,"Automatizaciones","/automatizaciones",items.map(i=>i.id),items[0]?{lastAutomation:{automationId:items[0].id,versionId:items[0].currentVersionId??undefined,action:"shown",shownAt:now.toISOString()}}:{});
}

export async function queryProfessionalTasks(action:string,context:ChatCommandContext|null):Promise<ChatCommandResult>{const {companyId}=await requireCompanyContext();const now=new Date(),start=new Date(now),end=new Date(now);start.setHours(0,0,0,0);end.setHours(23,59,59,999);let date:Record<string,unknown>={};if(action==="tasks_today")date={dueAt:{gte:start,lte:end}};if(action==="tasks_overdue")date={dueAt:{lt:start}};if(action==="tasks_week")date={dueAt:{gte:start,lte:new Date(start.getTime()+7*86400000)}};const items=await prisma.task.findMany({where:{companyId,...date,status:action==="tasks_blocked"?"blocked":{notIn:["completed","cancelled","archived"]},archivedAt:null},orderBy:{dueAt:"asc"},take:action==="tasks_next"?1:10});return queryResult(items.length?`${items.length} tareas:\n${items.map(i=>`- ${i.title}${i.dueAt?` · ${i.dueAt.toLocaleString("es-ES")}`:""} · ${i.status}`).join("\n")}`:"No hay tareas con ese filtro.",context,"task",items[0]?.id,"Tareas","/tareas",items.map(i=>i.id),items[0]?{lastTask:{taskId:items[0].id,action:"shown",shownAt:now.toISOString()}}:{});}

export async function queryProfessionalFollowUps(action:string,context:ChatCommandContext|null):Promise<ChatCommandResult>{const {companyId}=await requireCompanyContext();const now=new Date();const where:Record<string,unknown>={companyId,archivedAt:null};if(action==="followups_overdue")where.nextActionAt={lt:now};else if(action==="followups_budget")where.budgetId={not:null};else if(action==="followups_invoice")where.invoiceId={not:null};else if(action==="followups_success")where.status="completed";else where.status={notIn:["completed","cancelled","archived"]};const items=await prisma.followUp.findMany({where,include:{attempts:{orderBy:{attemptedAt:"desc"},take:1}},orderBy:{nextActionAt:"asc"},take:action==="followups_next"?1:10});return queryResult(items.length?`${items.length} seguimientos:\n${items.map(i=>`- ${i.title}${i.nextActionAt?` · ${i.nextActionAt.toLocaleString("es-ES")}`:""} · ${i.status}`).join("\n")}`:"No hay seguimientos con ese filtro.",context,"followup",items[0]?.id,"Seguimientos","/seguimientos",items.map(i=>i.id),items[0]?{lastFollowUp:{followUpId:items[0].id,attemptId:items[0].attempts[0]?.id,action:"shown",shownAt:now.toISOString()}}:{});}

function queryResult(text:string,context:ChatCommandContext|null,entityType:"task"|"followup"|"automation",entityId:string|undefined,title:string,href:string,resultIds:string[],extra:Partial<ChatCommandContext>):ChatCommandResult{return{handled:true,context:{...(context??{}),...extra,lastQuery:{type:entityType,resultIds,timestamp:new Date().toISOString()}},text,result:{type:"found",entityType,entityId,title,summary:{count:resultIds.length},actions:[{label:"Abrir",href}]}}}

export function withQueryDiagnostics(result: ChatCommandResult, text: string, intent: ChatIntentClassification, handler: string, query: string): ChatCommandResult {
  return {
    ...result,
    diagnostics: {
      normalizedText: normalizeQueryText(text),
      intentKind: intent.kind,
      action: intent.action,
      confidence: intent.confidence,
      rule: intent.rule,
      handler,
      query,
      noMutation: true,
      resultCount: result.diagnostics?.resultCount,
      responseLength: result.text.length
    }
  };
}

export function handlerNameForIntent(intent: ChatIntentClassification) {
  if (intent.kind === "pending_summary") return "queryPendingTasksSummary";
  if (intent.kind === "pending_details") return "queryPendingTaskDetails";
  if (intent.action === "highest_budget") return "queryBudgetByAmount/highest";
  if (intent.action === "lowest_budget") return "queryBudgetByAmount/lowest";
  if (intent.action === "budget_by_amount") return "queryBudgetByExactAmount";
  if (intent.action === "outstanding_invoices") return "queryBusinessMetric/outstanding";
  if (intent.action === "client_highest_debt") return "queryBusinessClientHighestDebt";
  if (intent.action === "business_health") return "queryBusinessHealth";
  if (intent.action === "business_collected") return "queryBusinessMetric/collected";
  if (intent.action === "business_outstanding") return "queryBusinessMetric/outstanding";
  if (intent.action === "business_overdue") return "queryBusinessMetric/overdue";
  if (intent.action === "business_profit") return "queryBusinessProfit";
  if (intent.action === "business_margin") return "queryBusinessMargin";
  if (intent.action === "business_best_work") return "queryBusinessBestWork";
  if (intent.action === "business_slowest_client") return "queryBusinessSlowestClient";
  if (intent.action === "business_quote_conversion") return "queryBusinessQuoteConversion";
  if (intent.action === "business_compare_periods") return "queryBusinessComparison";
  if (intent.action === "business_review_today") return "queryBusinessReviewToday";
  if (intent.action?.startsWith("signals_")) return `queryBusinessSignals/${intent.action}`;
  if (intent.action?.startsWith("treasury_")) return `queryTreasury/${intent.action}`;
  if (intent.action === "work_highest_revenue") return "queryWorkHighestRevenue";
  if (intent.action === "work_lowest_margin") return "queryWorkLowestMargin";
  if (intent.action === "paused_projects") return "queryWorksByStatus/paused";
  if (intent.action === "works_starting_this_week") return "queryWorksStartingThisWeek";
  if (intent.action === "works_ending_today") return "queryWorksEndingToday";
  if (intent.action === "client_contacts") return "queryClientContacts";
  if (intent.action === "work_documents") return "queryWorkDocuments";
  if (intent.action === "internal_notes") return "queryInternalNotes";
  if (intent.action === "agenda_today") return "queryAgendaToday";
  if (intent.action === "upcoming_visits") return "queryUpcomingVisits";
  if (intent.action === "pending_reminders_count") return "queryPendingRemindersCount";
  if (intent.action === "pending_notifications") return "queryPendingNotifications";
  return intent.action ?? intent.kind;
}

export function isPendingDetailFollowUp(normalized: string) {
  return /^(dimelos|dimelas|dime cuales|cuales son|detallame|detalle|ver todos|muestrame|ensename|dime los pendientes|dime las pendientes)$/.test(normalized);
}

export function isPendingDetailCategory(value: unknown): value is PendingDetailCategory {
  return typeof value === "string" && [
    "budgets",
    "budgets_to_send",
    "budgets_to_accept",
    "invoices",
    "overdue_invoices",
    "partial_payments",
    "visits",
    "visits_to_confirm",
    "followups",
    "reminders",
    "clients_incomplete",
    "active_projects",
    "documents"
  ].includes(value);
}

export async function queryPendingTasksSummary(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const counts = await queryPendingTasksCounts();
  const rows = pendingSummaryRows(counts);
  const firstCategory = rows[0]?.category;
  const nextContext = withLastQuery(context, {
    type: "pending_summary",
    category: firstCategory,
    filters: { categories: rows.map((row) => row.category), counts },
    resultIds: [],
    handler: "queryPendingTasksSummary",
    timestamp: new Date().toISOString()
  });

  if (!rows.length) {
    return {
      handled: true,
      context: nextContext,
      diagnostics: { resultCount: 0 },
      text: "No tienes tareas pendientes ahora mismo."
    };
  }

  return {
    handled: true,
    context: nextContext,
    diagnostics: { resultCount: rows.length },
    text: `Tienes:\n\n${rows.map(({ label, count }) => `- ${count} ${pendingCountLabel(label, count)}.`).join("\n")}\n\n¿Quieres que te detalle alguna categoría?`
  };
}

async function queryPendingTasksCounts() {
  const { companyId } = await requireCompanyContext();
  const today = startOfDay(new Date());
  const invoiceBalances = await findOpenInvoiceBalances();
  const [
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingVisits,
    visitsToConfirm,
    pendingFollowups,
    pendingReminders,
    clients,
    activeProjects,
    incompleteDocuments
  ] = await Promise.all([
    prisma.budget.count({ where: { companyId, estado: { in: ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] } } }),
    prisma.budget.count({ where: { companyId, estado: { in: ["borrador", "pendiente_revision"] } } }),
    prisma.budget.count({ where: { companyId, estado: { in: ["pendiente_respuesta", "enviado", "visto"] } } }),
    prisma.eventoAgenda.count({ where: { companyId, tipo: "visita", estado: { in: ["pendiente", "confirmado"] } } }),
    prisma.eventoAgenda.count({ where: { companyId, tipo: "visita", estado: "pendiente", requiereConfirmacion: true } }),
    prisma.reminder.count({ where: { companyId, tipo: { in: ["seguimiento_presupuesto", "recordatorio_factura", "confirmar_visita"] }, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.reminder.count({ where: { companyId, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.client.findMany({ where: { companyId }, select: { telefono: true, email: true, direccion: true, estado: true, notas: true } }),
    prisma.work.count({ where: { companyId, estado: { in: ACTIVE_WORK_STATUSES as WorkStatus[] } } }),
    prisma.budget.count({ where: { companyId, estado: { in: ["borrador", "pendiente_revision"] } } })
  ]);

  return {
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingInvoices: invoiceBalances.length,
    overdueInvoices: invoiceBalances.filter(({ invoice }) => invoice.estado === "vencida" || invoice.fechaVencimiento < today).length,
    partialPayments: invoiceBalances.filter(({ paid }) => paid > 0).length,
    pendingVisits,
    visitsToConfirm,
    pendingFollowups,
    pendingReminders,
    incompleteClients: clients.filter(clientLooksIncomplete).length,
    activeProjects,
    incompleteDocuments
  };
}

function pendingSummaryRows(counts: Awaited<ReturnType<typeof queryPendingTasksCounts>>) {
  return [
    { label: "Presupuestos pendientes", count: counts.pendingBudgets, category: "budgets" as PendingDetailCategory },
    { label: "Presupuestos pendientes de enviar", count: counts.budgetsToSend, category: "budgets_to_send" as PendingDetailCategory },
    { label: "Presupuestos pendientes de aceptar", count: counts.budgetsToAccept, category: "budgets_to_accept" as PendingDetailCategory },
    { label: "Facturas pendientes de cobro", count: counts.pendingInvoices, category: "invoices" as PendingDetailCategory },
    { label: "Facturas vencidas", count: counts.overdueInvoices, category: "overdue_invoices" as PendingDetailCategory },
    { label: "Pagos parciales", count: counts.partialPayments, category: "partial_payments" as PendingDetailCategory },
    { label: "Visitas pendientes", count: counts.pendingVisits, category: "visits" as PendingDetailCategory },
    { label: "Visitas por confirmar", count: counts.visitsToConfirm, category: "visits_to_confirm" as PendingDetailCategory },
    { label: "Seguimientos pendientes", count: counts.pendingFollowups, category: "followups" as PendingDetailCategory },
    { label: "Recordatorios pendientes", count: counts.pendingReminders, category: "reminders" as PendingDetailCategory },
    { label: "Clientes con datos incompletos", count: counts.incompleteClients, category: "clients_incomplete" as PendingDetailCategory },
    { label: "Obras activas con tareas pendientes", count: counts.activeProjects, category: "active_projects" as PendingDetailCategory },
    { label: "Documentos pendientes de completar", count: counts.incompleteDocuments, category: "documents" as PendingDetailCategory }
  ].filter((row) => row.count > 0);
}

export function withLastQuery(context: ChatCommandContext | null, lastQuery: NonNullable<ChatCommandContext["lastQuery"]>): ChatCommandContext {
  return {
    ...(context ?? {}),
    lastQuery
  };
}

export async function queryPendingTaskDetails(category: PendingDetailCategory | undefined, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  category = category ?? (isPendingDetailCategory(context?.lastQuery?.category) ? context.lastQuery.category : undefined);
  if (!category) {
    return {
      handled: true,
      context,
      diagnostics: { resultCount: 0 },
      text: "Dime qué categoría quieres detallar: presupuestos, facturas, visitas, seguimientos, recordatorios, clientes, obras o documentos."
    };
  }

  const today = startOfDay(new Date());
  if (category === "budgets" || category === "budgets_to_send" || category === "budgets_to_accept" || category === "documents") {
    const states = category === "budgets_to_send"
      ? (["borrador", "pendiente_revision"] as const)
      : category === "budgets_to_accept"
        ? (["pendiente_respuesta", "enviado", "visto"] as const)
        : (["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] as const);
    const budgets = await prisma.budget.findMany({
      where: { companyId, estado: { in: [...states] } },
      orderBy: { fechaCreacion: "desc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(budgets, "presupuestos pendientes", (budget) => `${budget.numero} · ${budget.client.nombre} · ${formatEuros(budget.total)} · ${budget.estado} · /presupuestos/${budget.id}`, {
      context: withPendingDetailLastQuery(context, category, budgets.map((budget) => budget.id)),
      resultCount: budgets.length
    });
  }

  if (category === "invoices" || category === "overdue_invoices" || category === "partial_payments") {
    const balances = (await findOpenInvoiceBalances())
      .filter(({ invoice, paid }) => {
        if (category === "overdue_invoices") return invoice.estado === "vencida" || invoice.fechaVencimiento < today;
        if (category === "partial_payments") return paid > 0;
        return true;
      })
      .sort((a, b) => a.invoice.fechaVencimiento.getTime() - b.invoice.fechaVencimiento.getTime())
      .slice(0, 10);
    return compactListResult(balances, "facturas", ({ invoice, pending }) => `${invoice.numero} · ${invoice.client.nombre} · pendiente ${formatEuros(pending)} · vence ${formatDateShort(invoice.fechaVencimiento)} · /dinero/${invoice.id}`, {
      context: withPendingDetailLastQuery(context, category, balances.map(({ invoice }) => invoice.id)),
      resultCount: balances.length
    });
  }

  if (category === "visits" || category === "visits_to_confirm") {
    const visits = await prisma.eventoAgenda.findMany({
      where: category === "visits_to_confirm"
        ? { companyId, tipo: "visita", estado: "pendiente", requiereConfirmacion: true }
        : { companyId, tipo: "visita", estado: { in: ["pendiente", "confirmado"] } },
      orderBy: { fechaInicio: "asc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(visits, "visitas", (visit) => `${formatDateShort(visit.fechaInicio)} ${visit.horaInicio ?? ""} · ${visit.client?.nombre ?? "Sin cliente"} · ${visit.titulo} · /agenda`, {
      context: withPendingDetailLastQuery(context, category, visits.map((visit) => visit.id)),
      resultCount: visits.length
    });
  }

  if (category === "followups" || category === "reminders") {
    const reminders = await prisma.reminder.findMany({
      where: category === "followups"
        ? { companyId, tipo: { in: ["seguimiento_presupuesto", "recordatorio_factura", "confirmar_visita"] }, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } }
        : { companyId, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } },
      orderBy: { fechaProgramada: "asc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(reminders, category === "followups" ? "seguimientos" : "recordatorios", (reminder) => `${formatDateShort(reminder.fechaProgramada)} · ${reminder.client?.nombre ?? "Sin cliente"} · ${reminder.tipo.replaceAll("_", " ")} · ${reminder.estado} · /recordatorios`, {
      context: withPendingDetailLastQuery(context, category, reminders.map((reminder) => reminder.id)),
      resultCount: reminders.length
    });
  }

  if (category === "clients_incomplete") {
    const clients = (await prisma.client.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" }, take: 60 })).filter(clientLooksIncomplete).slice(0, 10);
    return compactListResult(clients, "clientes con datos incompletos", (client) => `${client.nombre} · ${client.estado} · /clientes/${client.id}`, {
      context: withPendingDetailLastQuery(context, category, clients.map((client) => client.id)),
      resultCount: clients.length
    });
  }

  const works = await prisma.work.findMany({
    where: { companyId, estado: { in: ACTIVE_WORK_STATUSES as WorkStatus[] } },
    orderBy: { fechaInicio: "desc" },
    take: 10,
    include: { client: true }
  });
  return compactListResult(works, "obras activas", (work) => `${work.titulo} · ${work.client.nombre} · ${work.estado} · /obras`, {
    context: withPendingDetailLastQuery(context, category, works.map((work) => work.id)),
    resultCount: works.length
  });
}

export async function queryBudgetByAmount(direction: "asc" | "desc", intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { companyId, ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { total: direction },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay presupuestos registrados todavía." };
  const label = direction === "desc" ? "más alto" : "más bajo";
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    result: budgetQueryCard(`Presupuesto ${label}`, budget),
    text: `El presupuesto ${label} es el ${budget.numero}, por ${formatEuros(budget.total)}, para ${budget.client.nombre}.\n\n¿Quieres que te muestre los cinco presupuestos ${direction === "desc" ? "más altos" : "más bajos"}?`
  };
}
