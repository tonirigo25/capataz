import Link from "next/link";
import { Copy, Download, Eye, FileText, MessageCircle, Pencil, Plus, Search, Send } from "lucide-react";
import { duplicateBudget } from "@/app/(app)/presupuestos/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import {
  ActionMenu,
  EmptyState,
  CompactFilterBar,
  MetricStrip,
  MobileList,
  PageHeader,
  ResponsiveTable,
  ResultCount,
  CompactSearch,
  Tabs
} from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

const filters = [
  ["todos", "Todos"],
  ["pendientes", "Pendientes"],
  ["borrador", "Borradores"],
  ["pendiente_revision", "Revisión"],
  ["enviado", "Enviados"],
  ["pendiente_respuesta", "Sin respuesta"],
  ["aceptado", "Aceptados"],
  ["rechazado", "Rechazados"],
  ["caducado", "Caducados"]
] as const;

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ filtro?: string; buscar?: string }> }) {
  const query = await searchParams;
  const activeFilter = query.filtro ?? "todos";
  const { companyId } = await requireCapability("sales.budgets.view");
  const budgets = await prisma.budget.findMany({
    where: { companyId },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true }
  });
  const visibleBudgets = budgets.filter((budget) => {
    const filterMatch = activeFilter === "todos" ||
      (activeFilter === "pendientes" && ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"].includes(budget.estado)) ||
      budget.estado === activeFilter;
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${budget.numero} ${budget.titulo} ${budget.client.nombre} ${budget.work?.titulo ?? ""}`);
    return filterMatch && (!search || text.includes(search));
  });
  const pending = budgets.filter((budget) => ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"].includes(budget.estado));
  const accepted = budgets.filter((budget) => budget.estado === "aceptado");
  const totalAccepted = accepted.reduce((sum, budget) => sum + budget.total, 0);
  const hasCriteria = activeFilter !== "todos" || Boolean(query.buscar);

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Ventas"
        title="Presupuestos"
        description="Prepara, envía y sigue cada propuesta sin perder de vista su validez y próxima acción."
        action={<DemoLimitButton href="/gestion?tipo=presupuesto&returnTo=/presupuestos" currentCount={budgets.length} limit={2}><Plus size={18} /> Nuevo presupuesto</DemoLimitButton>}
        secondaryActions={<Link href="/presupuestos/plantillas" className="secondary-button"><FileText size={18} /> Plantillas</Link>}
      />

      <MetricStrip className="mb-5">
        <StatCard title="Total" value={String(budgets.length)} detail="Presupuestos registrados" icon={FileText} />
        <StatCard title="Pendientes" value={String(pending.length)} detail="Revisión, envío o respuesta" icon={Send} tone={pending.length ? "warning" : "neutral"} />
        <StatCard title="Aceptados" value={String(accepted.length)} detail="Propuestas aprobadas" icon={FileText} tone="success" />
        <StatCard title="Importe aceptado" value={formatCurrency(totalAccepted)} detail="Sin alterar facturación" icon={FileText} />
      </MetricStrip>

      <CompactFilterBar className="mb-4">
        <form action="/presupuestos" className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]">
          <input type="hidden" name="filtro" value={activeFilter} />
          <label>
            <span className="label mb-1 block">Buscar</span>
            <CompactSearch name="buscar" defaultValue={query.buscar ?? ""} placeholder="Número, cliente, trabajo o título…" />
          </label>
          <button className="primary-button self-end" type="submit"><Search size={18} /> Buscar</button>
        </form>
        <Tabs label="Estados de presupuesto" className="mt-3">
          {filters.map(([id, label]) => (
            <Link key={id} href={budgetHref(id, query.buscar)} aria-current={activeFilter === id ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${activeFilter === id ? "bg-obra-ink text-white" : "text-slate-600 hover:bg-white"}`}>
              {label}
            </Link>
          ))}
        </Tabs>
      </CompactFilterBar>

      <ResultCount shown={visibleBudgets.length} total={budgets.length} noun="presupuestos" context={hasCriteria ? <Link href="/presupuestos" className="font-bold text-obra-ink underline underline-offset-4">Limpiar filtros</Link> : null} />

      {visibleBudgets.length ? (
        <>
          <ResponsiveTable label="Presupuestos" className="mt-4">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                <tr><th scope="col" className="px-4 py-3">Presupuesto</th><th scope="col" className="px-4 py-3">Cliente y obra</th><th scope="col" className="px-4 py-3">Fecha</th><th scope="col" className="px-4 py-3 text-right">Importe</th><th scope="col" className="px-4 py-3">Estado</th><th scope="col" className="px-4 py-3">Próxima acción</th><th scope="col" className="px-4 py-3"><span className="sr-only">Abrir</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleBudgets.map((budget) => (
                  <tr key={budget.id} className="align-middle hover:bg-slate-50/70">
                    <td className="px-4 py-4"><Link href={`/presupuestos/${budget.id}`} className="font-black text-obra-ink hover:underline">{budget.numero}</Link><p className="mt-1 max-w-xs text-xs text-slate-500">{budget.titulo}</p></td>
                    <td className="px-4 py-4"><p className="font-bold text-obra-ink">{budget.client.nombre}</p><p className="text-xs text-slate-500">{budget.work?.titulo ?? "Sin obra"}</p></td>
                    <td className="px-4 py-4"><p>{formatDate(budget.fechaCreacion)}</p><p className="text-xs text-slate-500">Validez {formatDate(budget.fechaValidez)}</p></td>
                    <td className="px-4 py-4 text-right font-black text-obra-ink">{formatCurrency(budget.total)}</td>
                    <td className="px-4 py-4"><StatusPill status={budget.estado} /></td>
                    <td className="px-4 py-4 text-slate-600">{nextBudgetAction(budget.estado)}</td>
                    <td className="px-4 py-4 text-right"><Link href={`/presupuestos/${budget.id}`} className="secondary-button">Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>

          <MobileList className="mt-4">
            {visibleBudgets.map((budget) => <BudgetCard key={budget.id} budget={budget} />)}
          </MobileList>
        </>
      ) : (
        <div className="mt-4">
          <EmptyState
            title={hasCriteria ? "No hay presupuestos para estos filtros" : "Todavía no hay presupuestos"}
            description={hasCriteria ? "Prueba otra búsqueda o limpia los filtros activos." : "Crea el primer presupuesto para empezar a seguir propuestas y respuestas."}
            icon={Search}
            action={hasCriteria ? <Link href="/presupuestos" className="secondary-button">Limpiar filtros</Link> : <DemoLimitButton href="/gestion?tipo=presupuesto&returnTo=/presupuestos" currentCount={budgets.length} limit={2}>Crear presupuesto</DemoLimitButton>}
          />
        </div>
      )}
    </main>
  );
}

function BudgetCard({ budget }: { budget: Awaited<ReturnType<typeof prisma.budget.findMany>>[number] & { client: { nombre: string }; work: { titulo: string } | null } }) {
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="label">{budget.numero}</p><h2 className="mt-1 truncate text-lg font-black text-obra-ink">{budget.titulo}</h2><p className="mt-1 text-sm text-slate-500">{budget.client.nombre}{budget.work ? ` · ${budget.work.titulo}` : ""}</p></div><StatusPill status={budget.estado} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Mini label="Total" value={formatCurrency(budget.total)} /><Mini label="Validez" value={formatDate(budget.fechaValidez)} /><Mini label="Creado" value={formatDate(budget.fechaCreacion)} /><Mini label="Siguiente" value={nextBudgetAction(budget.estado)} /></div>
      <div className="mt-4 flex items-center gap-2"><Link href={`/presupuestos/${budget.id}`} className="primary-button flex-1">Abrir detalle</Link><ActionMenu><Link href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/presupuestos`}><Pencil size={17} /> Editar</Link><Link href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&returnTo=/presupuestos`}><MessageCircle size={17} /> Seguimiento</Link><form action={duplicateBudget}><input type="hidden" name="id" value={budget.id} /><ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?"><Copy size={17} /> Duplicar</ConfirmSubmitButton></form><Link href={`/presupuestos/${budget.id}/pdf?preview=1`} target="_blank"><Eye size={17} /> Vista PDF</Link><Link href={`/presupuestos/${budget.id}/pdf`}><Download size={17} /> Descargar</Link></ActionMenu></div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 line-clamp-2 font-black text-obra-ink">{value}</p></div>; }
function nextBudgetAction(status: string) { if (["borrador", "pendiente_revision"].includes(status)) return "Revisar y enviar"; if (["enviado", "visto", "pendiente_respuesta"].includes(status)) return "Preparar seguimiento"; if (status === "aceptado") return "Convertir o ejecutar"; if (status === "caducado") return "Actualizar validez"; if (status === "rechazado") return "Revisar propuesta"; return "Revisar"; }
function budgetHref(filter: string, search?: string) { const params = new URLSearchParams(); if (filter !== "todos") params.set("filtro", filter); if (search) params.set("buscar", search); const suffix = params.toString(); return suffix ? `/presupuestos?${suffix}` : "/presupuestos"; }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
