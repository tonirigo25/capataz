import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeEuro,
  Banknote,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  Euro,
  FileArchive,
  FileText,
  Hammer,
  Image,
  Lightbulb,
  Mail,
  Package,
  Phone,
  Receipt,
  Settings,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { EmptyState, Notice, PageHeader } from "@/components/ui-primitives";
import { EntityWorkflowSummary } from "@/components/entity-workflow-summary";
import { getRecommendationsForWork, type BusinessRecommendation } from "@/lib/business-recommendations";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { statusClass } from "@/lib/status";
import { getTreasuryOverview } from "@/lib/treasury";
import {
  buildWorkDocuments,
  buildWorkRisks,
  buildWorkTimeline,
  calculateWorkFinancials,
  getWorkNextAction,
  invoicePaid,
  workPriorityMeta,
  workStatusMeta
} from "@/lib/works";

export const dynamic = "force-dynamic";

const tabs = [
  ["resumen", "Resumen", BriefcaseBusiness],
  ["cliente", "Cliente", UserRound],
  ["contactos", "Contactos", Phone],
  ["presupuestos", "Presupuestos", FileText],
  ["facturas", "Facturas", Receipt],
  ["cobros", "Cobros", WalletCards],
  ["tesoreria", "Tesorería", Euro],
  ["gastos", "Gastos", Banknote],
  ["materiales", "Materiales", Package],
  ["horas", "Horas", Hammer],
  ["personal", "Personal", Users],
  ["subcontratas", "Subcontratas", ClipboardList],
  ["documentos", "Documentos", FileArchive],
  ["fotografias", "Fotografías", Camera],
  ["visitas", "Visitas", CalendarClock],
  ["recordatorios", "Recordatorios", Bell],
  ["notas", "Notas", ClipboardList],
  ["cronologia", "Cronología", Activity],
  ["ia", "IA", Bot],
  ["configuracion", "Configuración", Settings]
] as const;

export default async function WorkDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { companyId } = await requireCompanyContext();
  const [work, treasury, recommendations] = await Promise.all([
    prisma.work.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        contact: true,
        repositoryDocuments: { orderBy: { createdAt: "desc" } },
        internalNotes: { orderBy: { createdAt: "desc" } },
        budgets: { orderBy: { fechaCreacion: "desc" }, include: { reminders: true, agendaEvents: true } },
        invoices: { orderBy: { fechaEmision: "desc" }, include: { payments: true, reminders: true, agendaEvents: true } },
        payments: { orderBy: { fecha: "desc" }, include: { invoice: true } },
        expenses: { orderBy: { fecha: "desc" }, include: { businessPartner: { select: { id: true, commercialName: true, kind: true } }, purchaseInvoice: { select: { id: true, kind: true, invoiceNumber: true, pendingAmount: true } } } },
        materials: true,
        reminders: { orderBy: { fechaProgramada: "asc" }, include: { invoice: true, budget: true } },
        agendaEvents: { orderBy: { fechaInicio: "asc" }, include: { invoice: true, budget: true } },
        documents: { orderBy: { fecha: "desc" } },
        photos: { orderBy: { tomadaEn: "desc" } }
      }
    }),
    getTreasuryOverview({ companyId, workId: id, horizon: "30d", scenario: "base" }),
    getRecommendationsForWork(id, 3)
  ]);
  if (!work) notFound();

  const activeTab = tabs.some(([id]) => id === query.tab) ? query.tab! : "resumen";
  const financial = calculateWorkFinancials(work);
  const risks = buildWorkRisks(work);
  const timeline = buildWorkTimeline(work);
  const documents = buildWorkDocuments(work);
  const nextAction = getWorkNextAction(work);
  const status = workStatusMeta(work.estado);
  const priority = workPriorityMeta(work.prioridad);
  const pendingMaterials = work.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
  const openInvoices = work.invoices.filter((invoice) => Math.max(0, invoice.total - invoicePaid(invoice)) > 0);

  return (
    <main className="screen">
      <Link href="/obras" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Volver a obras
      </Link>

      <PageHeader
        eyebrow={work.codigo ?? work.numeroInterno ?? "Ficha 360"}
        title={work.titulo}
        description={`${work.client.nombre} · ${work.tipoTrabajo} · ${work.direccion}`}
        badge={<StatusBadge status={work.estado} />}
        action={<Link href={`/gestion?tipo=obra&id=${work.id}&returnTo=/obras/${work.id}`} className="primary-button">Editar obra</Link>}
        secondaryActions={<Link href={`/clientes/${work.clienteId}`} className="secondary-button">Abrir cliente</Link>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi icon={Euro} label="Presupuestado" value={formatCurrency(financial.budgeted)} detail={`${financial.budgetCount} presupuestos`} />
          <Kpi icon={Receipt} label="Facturado" value={formatCurrency(financial.invoiced)} detail={`${financial.invoiceCount} facturas`} />
          <Kpi icon={WalletCards} label="Cobrado" value={formatCurrency(financial.paid)} detail={`${formatCurrency(financial.pending)} pendiente`} tone={financial.pending ? "warning" : "success"} />
          <Kpi icon={Banknote} label="Gasto" value={formatCurrency(financial.realCost)} detail={`${formatCurrency(financial.deviation)} desviación`} tone={financial.deviation > 0 ? "warning" : "neutral"} />
          <Kpi icon={BadgeEuro} label="Beneficio" value={formatCurrency(financial.benefit)} detail={`${financial.marginPercent}% margen`} tone={financial.marginPercent < 15 && financial.budgeted ? "danger" : "success"} />
          <Kpi icon={AlertTriangle} label="Riesgos" value={String(risks.length)} detail={nextAction.label} tone={risks.length ? "warning" : "success"} />
        </div>
      </PageHeader>
      <EntityWorkflowSummary clientId={work.clienteId} workId={work.id} />

      <QuickActions workId={work.id} clientId={work.clienteId} />

      {recommendations.recommendations.length ? (
        <RecommendationStrip title="Recomendaciones de esta obra" recommendations={recommendations.recommendations} href={`/recomendaciones?estado=active&q=${encodeURIComponent(work.titulo)}`} />
      ) : null}

      <nav className="my-5 flex gap-2 overflow-x-auto pb-1" aria-label="Pestañas de obra">
        {tabs.map(([id, label, Icon]) => (
          <Link key={id} href={`/obras/${work.id}?tab=${id}`} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${activeTab === id ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === "resumen" ? (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="grid gap-4">
            <Section title="Próxima acción">
              <Notice tone={nextAction.tone === "danger" ? "danger" : nextAction.tone === "warning" ? "warning" : "info"} description={nextAction.label} />
            </Section>
            <Section title="Rentabilidad">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Finance label="Presupuestado" value={financial.budgeted} />
                <Finance label="Facturado" value={financial.invoiced} />
                <Finance label="Cobrado" value={financial.paid} />
                <Finance label="Pendiente" value={financial.pending} tone={financial.pending ? "warning" : "neutral"} />
                <Finance label="Gasto real" value={financial.realCost} />
                <Finance label="Coste materiales" value={financial.materialExpenses} />
                <Finance label="Coste subcontratas" value={financial.subcontractorExpenses} />
                <Finance label="Costes generales" value={financial.generalExpenses} />
                <Finance label="Coste previsto" value={financial.forecastCost} />
                <Finance label="Beneficio" value={financial.benefit} tone={financial.benefit < 0 ? "danger" : "success"} />
                <Finance label="Desviación" value={financial.deviation} tone={financial.deviation > 0 ? "warning" : "success"} />
              </div>
            </Section>
            <Section title="Riesgos">
              {risks.length ? (
                <div className="grid gap-3">
                  {risks.map((risk) => <Risk key={risk.key} risk={risk} />)}
                </div>
              ) : (
                <EmptyState title="Sin riesgos operativos detectados" description="No hay alertas por margen, cobro, materiales o fechas vencidas." icon={CheckCircle2} />
              )}
            </Section>
          </section>
          <aside className="grid gap-4">
            <Section title="Estado operativo">
              <InfoGrid rows={[
                ["Estado", status.label],
                ["Prioridad", priority.label],
                ["Responsable", work.responsable ?? "Sin asignar"],
                ["Comercial", work.comercial ?? "Sin asignar"],
                ["Jefe de obra", work.jefeObra ?? "Sin asignar"],
                ["Inicio previsto", formatDate(work.fechaInicioPrevista ?? work.fechaInicio)],
                ["Inicio real", formatDate(work.fechaInicioReal)],
                ["Fin previsto", formatDate(work.fechaFinPrevista)],
                ["Fin real", formatDate(work.fechaFinReal)]
              ]} />
              <div className="mt-3 flex flex-wrap gap-2">
                <WorkStatusButton id={work.id} estado="en_curso" label="Iniciar" />
                <WorkStatusButton id={work.id} estado="pendiente_material" label="Bloquear por material" />
                <WorkStatusButton id={work.id} estado="finalizada" label="Finalizar" />
                <WorkStatusButton id={work.id} estado="archivada" label="Archivar" />
              </div>
            </Section>
            <Section title="Actividad reciente">
              <TimelineList items={timeline.slice(0, 5)} />
            </Section>
          </aside>
        </div>
      ) : null}

      {activeTab === "cliente" ? <ClientTab work={work} /> : null}
      {activeTab === "contactos" ? <ContactsTab work={work} /> : null}
      {activeTab === "presupuestos" ? <CardsTab items={work.budgets} empty="No hay presupuestos asociados." render={(budget) => <BudgetCard key={budget.id} budget={budget} />} /> : null}
      {activeTab === "facturas" ? <CardsTab items={work.invoices} empty="No hay facturas asociadas." render={(invoice) => <InvoiceCard key={invoice.id} invoice={invoice} />} /> : null}
      {activeTab === "cobros" ? <CardsTab items={work.payments} empty="No hay cobros registrados en esta obra." render={(payment) => <PaymentCard key={payment.id} payment={payment} />} /> : null}
      {activeTab === "tesoreria" ? <WorkTreasuryTab treasury={treasury} workId={work.id} /> : null}
      {activeTab === "gastos" ? <CardsTab items={work.expenses} empty="No hay gastos registrados." render={(expense) => <ExpenseCard key={expense.id} expense={expense} />} /> : null}
      {activeTab === "materiales" ? <MaterialsTab materials={work.materials} pendingCount={pendingMaterials.length} workId={work.id} /> : null}
      {activeTab === "horas" ? <HoursTab work={work} /> : null}
      {activeTab === "personal" ? <PeopleTab work={work} /> : null}
      {activeTab === "subcontratas" ? <SubcontractTab work={work} expenses={work.expenses} /> : null}
      {activeTab === "documentos" ? <DocumentsTab documents={documents} workId={work.id} clientId={work.clienteId} /> : null}
      {activeTab === "fotografias" ? <PhotosTab photos={work.photos} workId={work.id} /> : null}
      {activeTab === "visitas" ? <CardsTab items={work.agendaEvents} empty="No hay visitas o eventos registrados." render={(event) => <EventCard key={event.id} event={event} />} /> : null}
      {activeTab === "recordatorios" ? <CardsTab items={work.reminders} empty="No hay recordatorios asociados." render={(reminder) => <ReminderCard key={reminder.id} reminder={reminder} />} /> : null}
      {activeTab === "notas" ? <NotesTab notes={work.internalNotes} workId={work.id} clientId={work.clienteId} /> : null}
      {activeTab === "cronologia" ? <Section title="Cronología completa"><TimelineList items={timeline} /></Section> : null}
      {activeTab === "ia" ? <AiTab work={work} financial={financial} risks={risks} openInvoices={openInvoices.length} pendingMaterials={pendingMaterials.length} documents={documents.length} /> : null}
      {activeTab === "configuracion" ? <ConfigTab work={work} /> : null}
    </main>
  );
}

function QuickActions({ workId, clientId }: { workId: string; clientId: string }) {
  const returnTo = encodeURIComponent(`/obras/${workId}`);
  const actions = [
    [`/gestion?tipo=presupuesto&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear presupuesto", FileText],
    [`/gestion?tipo=factura&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear factura", Receipt],
    [`/gestion?tipo=gasto&obraId=${workId}&returnTo=${returnTo}`, "Registrar gasto", Banknote],
    [`/gestion?tipo=pago&returnTo=${returnTo}`, "Registrar pago", WalletCards],
    [`/gestion?tipo=eventoAgenda&clienteId=${clientId}&obraId=${workId}&tipoEvento=visita&returnTo=${returnTo}`, "Añadir visita", CalendarClock],
    [`/gestion?tipo=material&obraId=${workId}&returnTo=${returnTo}`, "Añadir material", Package],
    [`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&category=otro&returnTo=${returnTo}`, "Añadir documento", FileArchive],
    [`/gestion?tipo=foto&obraId=${workId}&returnTo=${returnTo}`, "Añadir foto", Camera],
    [`/gestion?tipo=recordatorio&clienteId=${clientId}&obraId=${workId}&returnTo=${returnTo}`, "Crear recordatorio", Bell],
    [`/capataz`, "Abrir chat IA", Bot]
  ] as const;
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {actions.map(([href, label, Icon]) => (
        <Link key={href} href={href} className="secondary-button min-h-12 justify-center">
          <Icon size={17} />
          {label}
        </Link>
      ))}
      <button type="button" className="secondary-button min-h-12 justify-center opacity-70" title="Preparado para integración">
        <Phone size={17} />
        WhatsApp
      </button>
      <button type="button" className="secondary-button min-h-12 justify-center opacity-70" title="Preparado para integración">
        <Mail size={17} />
        Email
      </button>
    </section>
  );
}

function RecommendationStrip({ title, recommendations, href }: { title: string; recommendations: BusinessRecommendation[]; href: string }) {
  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-black"><Lightbulb size={18} /> {title}</p>
          <div className="mt-2 grid gap-2 text-sm leading-6">
            {recommendations.slice(0, 3).map((recommendation) => (
              <p key={recommendation.fingerprint}>
                <span className="font-black">Prioridad {recommendation.priority}</span> · {recommendation.title}: {recommendation.summary}
              </p>
            ))}
          </div>
        </div>
        <Link href={href} className="secondary-button bg-white">Ver todas</Link>
      </div>
    </section>
  );
}

function ClientTab({ work }: { work: any }) {
  return (
    <Section title="Cliente">
      <InfoGrid rows={[
        ["Nombre", work.client.nombre],
        ["Razón social", work.client.razonSocial ?? "No registrada"],
        ["NIF/CIF", work.client.nifCif ?? "No registrado"],
        ["Teléfono", work.client.telefono ?? "No registrado"],
        ["Email", work.client.email ?? "No registrado"],
        ["Dirección fiscal", work.client.direccionFiscal ?? work.client.direccion ?? "No registrada"],
        ["Estado CRM", work.client.estado]
      ]} />
      <Link href={`/clientes/${work.clienteId}`} className="primary-button mt-4 inline-flex">Abrir ficha cliente</Link>
    </Section>
  );
}

function ContactsTab({ work }: { work: any }) {
  const rows: Array<[string, string]> = [
    ["Contacto de obra", work.contact ? `${work.contact.nombre}${work.contact.apellidos ? ` ${work.contact.apellidos}` : ""}` : work.contactoPrincipal ?? work.client.contactoPrincipalNombre ?? "No registrado"],
    ["Teléfono obra", work.contact?.telefono ?? work.contactoTelefono ?? work.client.contactoPrincipalTelefono ?? work.client.telefono ?? "No registrado"],
    ["Email obra", work.contact?.email ?? work.contactoEmail ?? work.client.contactoPrincipalEmail ?? work.client.email ?? "No registrado"],
    ["Facturación", work.client.contactoFacturacionNombre ?? "No registrado"],
    ["Email facturación", work.client.emailFacturacion ?? "No registrado"],
    ["Teléfono facturación", work.client.telefonoFacturacion ?? "No registrado"]
  ];
  return (
    <Section title="Contactos">
      <InfoGrid rows={rows} />
      <Link href={`/gestion?tipo=contacto&clientId=${work.clienteId}&returnTo=/obras/${work.id}?tab=contactos`} className="secondary-button mt-4 inline-flex">Añadir contacto</Link>
    </Section>
  );
}

function MaterialsTab({ materials, pendingCount, workId }: { materials: any[]; pendingCount: number; workId: string }) {
  return (
    <Section title={`Materiales · ${pendingCount} pendientes`}>
      {materials.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {materials.map((material) => (
            <article key={material.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <StatusBadge status={material.estado} />
              <h3 className="mt-3 font-black text-obra-ink">{material.nombre}</h3>
              <p className="mt-1 text-sm text-slate-600">{material.cantidad}</p>
              {material.notas ? <p className="mt-2 text-sm leading-6 text-slate-600">{material.notas}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No hay materiales registrados" description="Los materiales aparecerán aquí cuando se registren desde gestión o Capataz." icon={Package} action={<Link href={`/gestion?tipo=material&obraId=${workId}&returnTo=/obras/${workId}`} className="secondary-button">Añadir material</Link>} />
      )}
    </Section>
  );
}

function WorkTreasuryTab({ treasury, workId }: { treasury: Awaited<ReturnType<typeof getTreasuryOverview>>; workId: string }) {
  const work = treasury.workProfitability.find((item) => item.workId === workId);
  const upcomingCollections = treasury.receivables.filter((item) => item.workId === workId).slice(0, 5);
  const upcomingPayments = treasury.payables.filter((item) => item.workId === workId).slice(0, 5);
  if (!work) return <Section title="Tesorería de obra"><EmptyState title="Sin datos financieros de obra" description="No hay facturas, cobros, gastos o movimientos asociados." icon={Euro} /></Section>;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Section title="Caja y rentabilidad">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Finance label="Entradas cobradas" value={work.collected} />
          <Finance label="Salidas pagadas" value={work.paidCost} />
          <Finance label="Flujo neto" value={work.cashFlow} tone={work.cashFlow < 0 ? "danger" : "success"} />
          <Finance label="Necesidad caja" value={work.cashNeed} tone={work.cashNeed > 0 ? "warning" : "neutral"} />
          <Finance label="Presupuestado" value={work.budgeted} />
          <Finance label="Coste real" value={work.realCost} />
          <Finance label="Desviación" value={work.costDeviation} tone={work.costDeviation > 0 ? "warning" : "success"} />
          <PlainMetric label="Margen real" value={`${work.marginOnInvoiced.toFixed(1)}%`} tone={work.marginOnInvoiced < 0 ? "danger" : "neutral"} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">El presupuesto no se considera entrada de caja. La caja de obra usa cobros, pagos y gastos registrados explícitamente.</p>
      </Section>
      <Section title="Próximos cobros y pagos">
        <div className="grid gap-4">
          <MiniTimeline title="Cobros previstos" items={upcomingCollections} empty="Sin cobros previstos para esta obra." />
          <MiniTimeline title="Pagos previstos" items={upcomingPayments} empty="Sin pagos previstos para esta obra." />
        </div>
        <Link href={`/tesoreria?obra=${workId}`} className="primary-button mt-4 inline-flex">Abrir tesorería filtrada</Link>
      </Section>
    </div>
  );
}

function MiniTimeline({ title, items, empty }: { title: string; items: Awaited<ReturnType<typeof getTreasuryOverview>>["forecast"]["items"]; empty: string }) {
  return (
    <div>
      <h3 className="font-black text-obra-ink">{title}</h3>
      <div className="mt-2 grid gap-2">
        {items.length ? items.map((item) => (
          <Link key={item.id} href={item.href ?? "/tesoreria"} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <span className="font-black text-obra-ink">{formatCurrency(item.amount)}</span>
            <span className="ml-2 text-slate-600">{item.title} · {formatDate(item.effectiveDate ?? item.date)}</span>
          </Link>
        )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{empty}</p>}
      </div>
    </div>
  );
}

function HoursTab({ work }: { work: any }) {
  const deviation = Number(work.horasReales ?? 0) - Number(work.horasEstimadas ?? 0);
  return (
    <Section title="Horas">
      <div className="grid gap-3 sm:grid-cols-3">
        <PlainMetric label="Estimadas" value={`${Number(work.horasEstimadas ?? 0)} h`} />
        <PlainMetric label="Reales" value={`${Number(work.horasReales ?? 0)} h`} />
        <PlainMetric label="Desviación" value={`${deviation} h`} tone={deviation > 0 ? "warning" : "neutral"} />
      </div>
    </Section>
  );
}

function PeopleTab({ work }: { work: any }) {
  return <Section title="Personal"><InfoGrid rows={[["Responsable", work.responsable ?? "Sin asignar"], ["Comercial", work.comercial ?? "Sin asignar"], ["Jefe de obra", work.jefeObra ?? "Sin asignar"]]} /></Section>;
}

function SubcontractTab({ work, expenses }: { work: any; expenses: any[] }) {
  const subcontractExpenses = expenses.filter((expense) => expense.categoria === "subcontrata");
  const total = subcontractExpenses.reduce((sum, expense) => sum + expense.importe, 0) + Number(work.subcontratasCoste ?? 0);
  return (
    <Section title="Subcontratas">
      <PlainMetric label="Coste total subcontratas" value={formatCurrency(total)} />
      <div className="mt-3 flex flex-wrap gap-2"><Link className="secondary-button" href="/subcontratas">Abrir subcontratas</Link><Link className="secondary-button" href={`/facturas-subcontratas?nuevo=1&obra=${work.id}#factura`}>Registrar factura</Link></div>
      <div className="mt-4">
        {subcontractExpenses.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{subcontractExpenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} />)}</div>
        ) : (
          <EmptyState title="No hay gastos de subcontrata imputados." description="Los gastos con categoría subcontrata aparecerán aquí." />
        )}
      </div>
    </Section>
  );
}

function DocumentsTab({ documents, workId, clientId }: { documents: Array<any>; workId: string; clientId: string }) {
  return (
    <Section title="Documentos">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/gestion?tipo=presupuesto&clienteId=${clientId}&obraId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><FileText size={17} /> Presupuesto</Link>
        <Link href={`/gestion?tipo=factura&clienteId=${clientId}&obraId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><Receipt size={17} /> Factura</Link>
        <Link href={`/gestion?tipo=documento&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=documentos`} className="secondary-button"><FileArchive size={17} /> Registrar documento</Link>
      </div>
      {documents.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {documents.map((document) => (
            <article key={document.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{document.type}</p>
              <h3 className="mt-1 font-black text-obra-ink">{document.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{document.source} · {formatDate(document.date)}</p>
              {document.href ? <Link href={document.href} className="secondary-button mt-3">Abrir</Link> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No hay documentos asociados" description="Los presupuestos, facturas y documentos reales aparecerán aquí." icon={FileArchive} />
      )}
    </Section>
  );
}

function PhotosTab({ photos, workId }: { photos: any[]; workId: string }) {
  return (
    <Section title="Fotografías">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/gestion?tipo=foto&obraId=${workId}&returnTo=/obras/${workId}?tab=fotografias`} className="secondary-button"><Camera size={17} /> Registrar foto</Link>
      </div>
      {photos.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{photo.categoria}</p>
              <h3 className="mt-1 font-black text-obra-ink">{photo.titulo}</h3>
              <p className="mt-1 text-sm text-slate-500">{formatDate(photo.tomadaEn)}</p>
              {photo.notas ? <p className="mt-2 text-sm leading-6 text-slate-600">{photo.notas}</p> : null}
              {photo.url ? <Link href={photo.url} className="secondary-button mt-3">Abrir foto</Link> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No hay fotografías registradas" description="Estructura preparada por categorías: antes, durante, después, incidencias, material y acabados. No se simula subida de archivos." icon={Image} action={<Link href={`/gestion?tipo=foto&obraId=${workId}&returnTo=/obras/${workId}?tab=fotografias`} className="secondary-button">Registrar foto</Link>} />
      )}
    </Section>
  );
}

function NotesTab({ notes, workId, clientId }: { notes: any[]; workId: string; clientId: string }) {
  const activeNotes = notes.filter((note) => !note.archivedAt);
  return (
    <Section title="Notas internas">
      <div className="mb-4">
        <Link href={`/gestion?tipo=notaInterna&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=notas`} className="secondary-button">Añadir nota</Link>
      </div>
      {activeNotes.length ? (
        <div className="grid gap-3">
          {activeNotes.map((note) => (
            <article key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="label">{formatDate(note.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.content}</p>
              <Link href={`/gestion?tipo=notaInterna&id=${note.id}&clientId=${clientId}&workId=${workId}&returnTo=/obras/${workId}?tab=notas`} className="secondary-button mt-3">Editar</Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No hay notas internas" description="Las notas internas no se incluyen en PDFs ni mensajes a clientes." icon={ClipboardList} />
      )}
    </Section>
  );
}

function AiTab({ work, financial, risks, openInvoices, pendingMaterials, documents }: { work: any; financial: ReturnType<typeof calculateWorkFinancials>; risks: any[]; openInvoices: number; pendingMaterials: number; documents: number }) {
  const answers = [
    ["Resume esta obra", `${work.titulo} para ${work.client.nombre}. Estado ${workStatusMeta(work.estado).label}. ${formatCurrency(financial.invoiced)} facturados y ${formatCurrency(financial.pending)} pendientes.`],
    ["Qué falta", getWorkNextAction(work).label],
    ["Qué riesgos hay", risks.length ? risks.map((risk) => risk.title).join(", ") : "No hay riesgos operativos detectados."],
    ["Qué documentos faltan", documents ? "Hay documentos asociados; revisa que contrato, garantía o certificado estén cargados si aplican." : "No hay documentos asociados todavía."],
    ["Qué materiales faltan", pendingMaterials ? `${pendingMaterials} materiales pendientes o en falta.` : "No hay materiales pendientes registrados."],
    ["Qué facturas faltan", financial.budgeted > financial.invoiced ? `Queda por facturar ${formatCurrency(financial.budgeted - financial.invoiced)} respecto al presupuesto.` : "No hay diferencia pendiente entre presupuesto y facturación."],
    ["Qué cobros faltan", openInvoices ? `${openInvoices} facturas abiertas por ${formatCurrency(financial.pending)}.` : "No hay cobros pendientes."],
    ["Qué visitas quedan", `${work.agendaEvents.filter((event: any) => !["cancelado", "realizado"].includes(event.estado)).length} visitas o eventos abiertos.`],
    ["Qué recordatorios existen", `${work.reminders.length} recordatorios asociados.`]
  ];
  return (
    <Section title="IA de obra">
      <div className="grid gap-3">
        {answers.map(([question, answer]) => (
          <article key={question} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-obra-ink">{question}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
          </article>
        ))}
      </div>
      <Link href="/capataz" className="primary-button mt-4 inline-flex"><Bot size={18} /> Preguntar en Capataz</Link>
    </Section>
  );
}

function ConfigTab({ work }: { work: any }) {
  return (
    <Section title="Configuración">
      <InfoGrid rows={[
        ["ID", work.id],
        ["Número interno", work.numeroInterno ?? "No asignado"],
        ["Código", work.codigo ?? "No asignado"],
        ["Archivada", work.archivada ? "Sí" : "No"],
        ["Archivada el", formatDate(work.archivadaAt)],
        ["Última modificación", formatDate(work.updatedAt)]
      ]} />
    </Section>
  );
}

function BudgetCard({ budget }: { budget: any }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <StatusBadge status={budget.estado} />
      <h3 className="mt-3 font-black text-obra-ink">{budget.numero} · {budget.titulo}</h3>
      <p className="mt-1 text-sm text-slate-500">{formatCurrency(budget.total)} · {formatDate(budget.fechaCreacion)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/presupuestos/${budget.id}`} className="secondary-button">Ver</Link>
        <Link href={`/presupuestos/${budget.id}/pdf?preview=1`} className="secondary-button">PDF</Link>
      </div>
    </article>
  );
}

function InvoiceCard({ invoice }: { invoice: any }) {
  const paid = invoicePaid(invoice);
  const pending = Math.max(0, invoice.total - paid);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <StatusBadge status={invoice.estado} />
      <h3 className="mt-3 font-black text-obra-ink">{invoice.numero} · {invoice.concepto}</h3>
      <p className="mt-1 text-sm text-slate-500">Total {formatCurrency(invoice.total)} · cobrado {formatCurrency(paid)} · pendiente {formatCurrency(pending)}</p>
      <Link href={`/dinero/${invoice.id}`} className="secondary-button mt-3">Abrir factura</Link>
    </article>
  );
}

function PaymentCard({ payment }: { payment: any }) {
  return <SimpleCard title={formatCurrency(payment.importe)} eyebrow={payment.tipo} detail={`${payment.metodo} · ${formatDate(payment.fecha)} · ${payment.invoice?.numero ?? "Factura"}`} />;
}

function ExpenseCard({ expense }: { expense: any }) {
  return <SimpleCard title={`${expense.proveedor} · ${formatCurrency(expense.importe)}`} eyebrow={expense.categoria} detail={`${expense.concepto} · ${formatDate(expense.fecha)}`} />;
}

function EventCard({ event }: { event: any }) {
  return <SimpleCard title={event.titulo} eyebrow={event.tipo} detail={`${event.estado} · ${formatDate(event.fechaInicio)}`} />;
}

function ReminderCard({ reminder }: { reminder: any }) {
  return <SimpleCard title={reminder.tipo.replaceAll("_", " ")} eyebrow={reminder.estado} detail={`${reminder.mensaje} · ${formatDate(reminder.fechaProgramada)}`} />;
}

function CardsTab<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => ReactNode }) {
  return (
    <Section title="Datos reales">
      {items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map(render)}</div> : <EmptyState title={empty} description="No se muestran placeholders ni datos inventados." />}
    </Section>
  );
}

function TimelineList({ items }: { items: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }> }) {
  if (!items.length) return <EmptyState title="Sin actividad registrada" description="La cronología se construye con presupuestos, facturas, pagos, gastos, visitas, recordatorios, documentos y fotos reales." icon={Activity} />;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.key} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Activity size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-black text-obra-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
            <p className="mt-1 text-xs font-bold uppercase text-slate-500">{formatDate(item.date)}</p>
            {item.href ? <Link href={item.href} className="mt-2 inline-flex text-sm font-bold text-obra-ink underline underline-offset-4">Abrir</Link> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function WorkStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  return (
    <form action={updateWorkStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button className="secondary-button" type="submit">{label}</button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <h2 className="mb-3 text-lg font-black text-obra-ink">{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-black text-obra-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon size={18} /></span>
      <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-obra-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Finance({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" | "success" }) {
  return <PlainMetric label={label} value={formatCurrency(value)} tone={tone} />;
}

function PlainMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-obra-ink";
  return (
    <div className={`rounded-lg p-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <p className="mt-1 font-black tabular-nums">{value}</p>
    </div>
  );
}

function Risk({ risk }: { risk: { level: "warning" | "danger"; title: string; detail: string } }) {
  return (
    <article className={`rounded-xl border p-4 ${risk.level === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-black">{risk.title}</p>
      <p className="mt-1 text-sm leading-6">{risk.detail}</p>
    </article>
  );
}

function SimpleCard({ title, eyebrow, detail }: { title: string; eyebrow: string; detail: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="label">{eyebrow}</p>
      <h3 className="mt-1 font-black text-obra-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = workStatusMeta(status);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>{meta.label}</span>;
}
