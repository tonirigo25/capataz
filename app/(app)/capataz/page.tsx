import { CapatazChat } from "@/components/capataz-chat";
import { PageHeader } from "@/components/ui-primitives";
import { getAgendaItems } from "@/lib/agenda";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CapatazPage() {
  const activeWorkStatuses = ["pendiente_inicio", "en_curso", "pausada", "pendiente_material", "pendiente_remates", "pendiente_cobro"];
  const [profile, company, clients, works, invoices, budgets, materials, programmedReminders, agendaItems] = await Promise.all([
    prisma.usuarioPerfil.findFirst(),
    prisma.empresa.findFirst(),
    prisma.client.findMany({ orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ orderBy: { titulo: "asc" }, include: { client: true } }),
    prisma.invoice.findMany({ orderBy: { fechaVencimiento: "asc" }, include: { client: true } }),
    prisma.budget.findMany({ orderBy: { fechaCreacion: "desc" }, include: { client: true } }),
    prisma.material.findMany({ include: { work: { include: { client: true } } } }),
    prisma.reminder.count({ where: { estado: "programado" } }),
    getAgendaItems()
  ]);

  return (
    <main className="screen">
      <PageHeader eyebrow="Asistente operativo" title="Capataz" description="Consulta y gestiona trabajo interno con contexto estructurado." />

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
          }
        }}
      />
    </main>
  );
}
