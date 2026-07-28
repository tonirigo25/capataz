import { CapatazChat } from "@/components/capataz-chat";
import { PageHeader } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";
import { getEconomicControl } from "@/lib/economic-control/queries";
import { getEffectiveCapabilities, resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function CapatazPage({ searchParams }: { searchParams: Promise<{ clienteId?: string; obraId?: string }> }) {
  const query = await searchParams;
  const auth = await requireCompanyContext();
  const [orqenaAccess, invoiceDecision, budgetDecision, pricingDecision, materialDecision, followupDecision] = await Promise.all([
    resolveAuthorization(auth, "orqena.use"), resolveAuthorization(auth, "sales.invoices.view"),
    resolveAuthorization(auth, "sales.budgets.view"), resolveAuthorization(auth, "sales.pricing.view"), resolveAuthorization(auth, "purchases.received_invoices.view"), resolveAuthorization(auth, "followups.view")
  ]);
  if (!orqenaAccess.allowed) return <main className="screen"><h1 className="type-page-title">Acceso a {brand.productName}</h1><p className="type-secondary mt-2">No tienes acceso a {brand.productName} en esta empresa.</p></main>;
  const economicCapabilities = ["sales.budgets.view", "sales.invoices.view", "treasury.view", "banking.view", "purchases.received_invoices.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"] as const;
  const economicDecisions = await Promise.all(economicCapabilities.map((capability) => resolveAuthorization(auth, capability)));
  const canSeeEconomy = economicDecisions.every((decision) => decision.allowed && decision.scope === "COMPANY");
  const capabilities = await getEffectiveCapabilities(auth);
  const capabilitySet = new Set<string>(capabilities);
  const [scopedWorkIds, scopedClientIds] = await Promise.all([
    capabilitySet.has("work.view") ? resolveScopedEntityIds(auth, "work.view", "Work") : Promise.resolve([]),
    capabilitySet.has("clients.view") ? resolveScopedEntityIds(auth, "clients.view", "Client") : Promise.resolve([])
  ]);
  const canSeeCompanyDetails = auth.role === "OWNER";
  const canSeeWorks = capabilitySet.has("work.view");
  const canSeeClients = capabilitySet.has("clients.view");
  const canSeeInvoices = invoiceDecision.allowed;
  const canSeeBudgets = budgetDecision.allowed && pricingDecision.allowed;
  const canSeeMaterials = materialDecision.allowed;
  const canSeeAgenda = capabilitySet.has("agenda.view");
  const canSeeReminders = followupDecision.allowed;
  const [invoiceWorkIds, invoiceClientIds, budgetWorkIds, budgetClientIds, pricingWorkIds, pricingClientIds, materialWorkIds, followupWorkIds, followupClientIds] = await Promise.all([
    canSeeInvoices ? resolveScopedEntityIds(auth, "sales.invoices.view", "Work") : Promise.resolve([]), canSeeInvoices ? resolveScopedEntityIds(auth, "sales.invoices.view", "Client") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.budgets.view", "Work") : Promise.resolve([]), canSeeBudgets ? resolveScopedEntityIds(auth, "sales.budgets.view", "Client") : Promise.resolve([]),
    canSeeBudgets ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work") : Promise.resolve([]), canSeeBudgets ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client") : Promise.resolve([]),
    canSeeMaterials ? resolveScopedEntityIds(auth, "purchases.received_invoices.view", "Work") : Promise.resolve([]),
    canSeeReminders ? resolveScopedEntityIds(auth, "followups.view", "Work") : Promise.resolve([]), canSeeReminders ? resolveScopedEntityIds(auth, "followups.view", "Client") : Promise.resolve([])
  ]);
  const activeWorkStatuses = ["pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_remates", "pendiente_cobro"];
  const [profile, company, clients, works, invoices, budgets, materials, programmedReminders, agendaItems] = await Promise.all([
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    canSeeCompanyDetails ? prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }).then(companySettingsView) : Promise.resolve(null),
    canSeeClients ? prisma.client.findMany({ where: { companyId: auth.companyId, ...(scopedClientIds === null ? {} : { id: { in: scopedClientIds } }) }, orderBy: { nombre: "asc" } }) : Promise.resolve([]),
    canSeeWorks ? prisma.work.findMany({ where: { companyId: auth.companyId, ...(scopedWorkIds === null ? {} : { id: { in: scopedWorkIds } }) }, orderBy: { titulo: "asc" }, include: { client: true } }) : Promise.resolve([]),
    canSeeInvoices ? prisma.invoice.findMany({ where: { companyId: auth.companyId, ...relationScope(invoiceDecision.scope, invoiceWorkIds, invoiceClientIds) }, orderBy: { fechaVencimiento: "asc" }, include: { client: true } }) : Promise.resolve([]),
    canSeeBudgets ? prisma.budget.findMany({ where: { companyId: auth.companyId, AND: [relationScope(budgetDecision.scope, budgetWorkIds, budgetClientIds), relationScope(pricingDecision.scope, pricingWorkIds, pricingClientIds)] }, orderBy: { fechaCreacion: "desc" }, include: { client: true } }) : Promise.resolve([]),
    canSeeMaterials ? prisma.material.findMany({ where: { companyId: auth.companyId, ...(materialWorkIds === null ? {} : { obraId: { in: materialWorkIds } }) }, include: { work: { include: { client: true } } } }) : Promise.resolve([]),
    canSeeReminders ? prisma.reminder.count({ where: { companyId: auth.companyId, estado: "programado", ...relationScope(followupDecision.scope, followupWorkIds, followupClientIds) } }) : Promise.resolve(0),
    canSeeAgenda ? getAgendaItems({ includeEconomic: true }) : Promise.resolve([])
  ]);
  const scopedWork = query.obraId ? works.find((work) => work.id === query.obraId) ?? null : null;
  const scopedClient = query.clienteId ? clients.find((client) => client.id === query.clienteId) ?? null : scopedWork ? clients.find((client) => client.id === scopedWork.clienteId) ?? null : null;
  const economic = canSeeEconomy ? await getEconomicControl({ clientId: scopedClient?.id, workId: scopedWork?.id, period: "30d" }) : null;

  return (
    <main className="screen">
      <div className="hidden md:block"><PageHeader eyebrow="Tu asistente" title={brand.productName} description="Consulta, prepara y revisa el trabajo de tu negocio." /></div>
      <header className="mb-3 md:hidden">
        <p className="type-label">Tu asistente</p>
        <h1 className="type-page-title mt-1">{brand.productName}</h1>
        <p className="type-secondary mt-1">Consulta, prepara y revisa tu trabajo.</p>
      </header>

      <CapatazChat
        userId={auth.userId}
        data={{
          capabilities,
          userProfile: profile
            ? {
                id: profile.id,
                nombre: profile.nombre,
                apellidos: profile.apellidos,
                nombrePreferido: profile.nombrePreferido,
                telefono: profile.telefono,
                email: profile.email,
                cargo: profile.cargo,
                oficioPrincipal: profile.oficioPrincipal,
                tonoPreferido: profile.tonoPreferido
              }
            : null,
          company: company
            ? {
                id: company.id,
                nombreComercial: company.nombreComercial,
                razonSocial: company.razonSocial,
                nifCif: company.nifCif,
                direccionFiscal: company.direccionFiscal,
                codigoPostal: company.codigoPostal,
                ciudad: company.ciudad,
                provincia: company.provincia,
                pais: company.pais,
                telefono: company.telefono,
                email: company.email,
                web: company.web,
                iban: company.iban,
                condicionesPorDefecto: company.condicionesPorDefecto,
                textoLegal: company.textoLegal,
                logoUrl: company.logoUrl,
                selloUrl: company.selloUrl,
                colorMarca: company.colorMarca,
                ivaDefecto: company.ivaDefecto,
                seriePresupuestos: company.seriePresupuestos,
                serieFacturas: company.serieFacturas,
                prefijoPresupuesto: company.prefijoPresupuesto,
                prefijoFactura: company.prefijoFactura
              }
            : null,
          completion: {
            profile: profileCompletion(profile),
            company: company ? companyCompletion(company) : { percent: 0, missingRequired: [], missingRecommended: [] }
          },
          clients: clients.map((client) => ({ id: client.id, nombre: client.nombre, estado: client.estado })),
          works: works.map((work) => ({ id: work.id, titulo: work.titulo, clientName: work.client.nombre })),
          invoices: invoices.map((invoice) => ({
            id: invoice.id,
            numero: invoice.numero,
            clientName: invoice.client.nombre,
            concepto: invoice.concepto,
            pendiente: invoice.pendiente,
            estado: invoice.estado
          })),
          budgets: budgets.map((budget) => ({
            id: budget.id,
            numero: budget.numero,
            clientName: budget.client.nombre,
            titulo: budget.titulo,
            total: budget.total,
            estado: budget.estado
          })),
          materials: materials.map((material) => ({
            nombre: material.nombre,
            cantidad: material.cantidad,
            estado: material.estado,
            workTitle: material.work.titulo,
            clientName: material.work.client.nombre
          })),
          agendaEvents: agendaItems.map((item) => ({
            id: item.id,
            source: item.source,
            title: item.titulo,
            type: item.tipo,
            status: item.estado,
            startsAt: item.fechaInicio.toISOString(),
            clientId: item.clienteId,
            clientName: item.clienteNombre,
            invoiceId: item.facturaId,
            invoiceNumber: item.facturaNumero,
            budgetId: item.presupuestoId,
            budgetNumber: item.presupuestoNumero,
            editable: item.editable
          })),
          demoLimits: {
            clientsCount: clients.length,
            clientsLimit: 3,
            budgetCount: budgets.length,
            budgetLimit: 2,
            activeWorks: works.filter((work) => activeWorkStatuses.includes(work.estado)).length,
            activeWorkLimit: 1,
            programmedReminders,
            reminderLimit: 3
          },
          operationalContext: null,
          economicContext: economic ? {
            entityName: scopedWork?.titulo ?? scopedClient?.nombre ?? auth.companyName,
            registeredBalance: scopedWork || scopedClient ? null : economic.registeredBalance,
            pendingReceivable: economic.receivableSummary.pending,
            overdueReceivable: economic.receivableSummary.overdue,
            pendingPayable: economic.payableSummary.pending,
            forecastNet: economic.forecast.net,
            href: `/tesoreria?vista=resumen&periodo=30d${scopedClient ? `&cliente=${scopedClient.id}` : ""}${scopedWork ? `&obra=${scopedWork.id}` : ""}`,
            suggestions: scopedWork
              ? [`Resume la posición económica de la obra ${scopedWork.titulo}`, `¿Qué vencimientos tiene la obra ${scopedWork.titulo}?`]
              : scopedClient
                ? [`Resume los cobros pendientes de ${scopedClient.nombre}`, `¿Qué facturas vencidas tiene ${scopedClient.nombre}?`]
                : ["Resume la posición económica actual", "¿Qué cobros y pagos requieren atención?"]
          } : null
        }}
      />
    </main>
  );
}

function relationScope(scope: string, workIds: string[] | null, clientIds: string[] | null) { if (scope === "COMPANY") return {}; if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } }; if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } }; const OR: Array<Record<string, unknown>> = []; if (workIds?.length) OR.push({ obraId: { in: workIds } }); if (clientIds?.length) OR.push({ clienteId: { in: clientIds }, obraId: null }); return OR.length ? { OR } : { id: { in: [] as string[] } }; }
