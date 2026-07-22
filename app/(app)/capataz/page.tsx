import { CapatazChat } from "@/components/capataz-chat";
import { PageHeader } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";
import { buildOperationalContext } from "@/lib/operational-intelligence/rules";
import { getOperationalIntelligence } from "@/lib/operational-intelligence/queries";
import { getEconomicControl } from "@/lib/economic-control/queries";

export const dynamic = "force-dynamic";

export default async function CapatazPage({ searchParams }: { searchParams: Promise<{ clienteId?: string; obraId?: string }> }) {
  const query = await searchParams;
  const auth = await requireCompanyContext();
  const activeWorkStatuses = ["pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_remates", "pendiente_cobro"];
  const [profile, company, clients, works, invoices, budgets, materials, programmedReminders, agendaItems, intelligence] = await Promise.all([
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }).then(companySettingsView),
    prisma.client.findMany({ where: { companyId: auth.companyId }, orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ where: { companyId: auth.companyId }, orderBy: { titulo: "asc" }, include: { client: true } }),
    prisma.invoice.findMany({ where: { companyId: auth.companyId }, orderBy: { fechaVencimiento: "asc" }, include: { client: true } }),
    prisma.budget.findMany({ where: { companyId: auth.companyId }, orderBy: { fechaCreacion: "desc" }, include: { client: true } }),
    prisma.material.findMany({ where: { companyId: auth.companyId }, include: { work: { include: { client: true } } } }),
    prisma.reminder.count({ where: { companyId: auth.companyId, estado: "programado" } }),
    getAgendaItems(),
    getOperationalIntelligence()
  ]);
  const scopedWork = query.obraId ? works.find((work) => work.id === query.obraId) ?? null : null;
  const scopedClient = query.clienteId ? clients.find((client) => client.id === query.clienteId) ?? null : scopedWork ? clients.find((client) => client.id === scopedWork.clienteId) ?? null : null;
  const economic = await getEconomicControl({ clientId: scopedClient?.id, workId: scopedWork?.id, period: "30d" });
  const contextualSignals = intelligence.signals.filter((signal) => scopedWork ? signal.entity.workId === scopedWork.id : scopedClient ? signal.entity.clientId === scopedClient.id : false);
  const operationalContext = scopedWork || scopedClient ? buildOperationalContext(contextualSignals) : null;

  return (
    <main className="screen">
      <div className="hidden md:block"><PageHeader eyebrow="Tu asistente" title="Orqena" description="Consulta, prepara y revisa el trabajo de tu negocio." /></div>

      <CapatazChat
        data={{
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
            company: companyCompletion(company)
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
          operationalContext: operationalContext ? {
            entityType: scopedWork ? "obra" as const : "cliente" as const,
            entityName: scopedWork?.titulo ?? scopedClient?.nombre ?? "",
            phrase: operationalContext.phrase,
            nextStep: operationalContext.nextStep,
            urgent: operationalContext.counts.urgente,
            attention: operationalContext.counts.atencion,
            suggestions: scopedWork
              ? [`Resume el contexto operativo de la obra ${scopedWork.titulo}`, `¿Qué requiere atención en la obra ${scopedWork.titulo}?`, `¿Cuál es el siguiente paso de la obra ${scopedWork.titulo}?`]
              : [`Resume el contexto operativo de ${scopedClient?.nombre}`, `¿Qué requiere atención con ${scopedClient?.nombre}?`, `¿Cuál es el siguiente paso con ${scopedClient?.nombre}?`]
          } : null,
          economicContext: {
            entityName: scopedWork?.titulo ?? scopedClient?.nombre ?? company.nombreComercial,
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
          }
        }}
      />
    </main>
  );
}
