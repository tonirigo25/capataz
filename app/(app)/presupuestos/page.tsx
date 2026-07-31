import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { duplicateBudget } from "@/app/(app)/presupuestos/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ListWorkspace } from "@/components/workspaces";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { StatusPill } from "@/components/status-pill";
import {
  CompactTabs,
  KpiCard,
  KpiGrid,
  ModuleHeader,
  ModulePanel,
  RatioRow,
  SoftBadge,
} from "@/components/portal/modules-b/module-frame";
import {
  ActionMenu,
  EmptyState,
  CompactFilterBar,
  MobileList,
  ResponsiveTable,
  ResultCount,
  CompactSearch,
} from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";

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
  ["caducado", "Caducados"],
] as const;

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const activeFilter = query.filtro ?? "todos";
  const auth = await requireCapability("sales.budgets.view");
  const { companyId } = auth;
  const [workIds, clientIds] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.budgets.view", "Work"),
    resolveScopedEntityIds(auth, "sales.budgets.view", "Client"),
  ]);
  const scopeWhere = relationScope(auth.scope, workIds, clientIds);
  const [
    createDecision,
    updateDecision,
    agendaDecision,
    pricingDecision,
    marginDecision,
  ] = await Promise.all([
    resolveAuthorization(auth, "sales.budgets.create"),
    resolveAuthorization(auth, "sales.budgets.update"),
    resolveAuthorization(auth, "agenda.manage"),
    resolveAuthorization(auth, "sales.pricing.view"),
    resolveAuthorization(auth, "margin_amount.view"),
  ]);
  const [
    createWorkIds,
    createClientIds,
    updateWorkIds,
    updateClientIds,
    agendaWorkIds,
    agendaClientIds,
    pricingWorkIds,
    pricingClientIds,
    marginWorkIds,
    marginClientIds,
  ] = await Promise.all([
    createDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Work")
      : Promise.resolve([]),
    createDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Client")
      : Promise.resolve([]),
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.update", "Work")
      : Promise.resolve([]),
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.update", "Client")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Work")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Client")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client")
      : Promise.resolve([]),
    marginDecision.allowed
      ? resolveScopedEntityIds(auth, "margin_amount.view", "Work")
      : Promise.resolve([]),
    marginDecision.allowed
      ? resolveScopedEntityIds(auth, "margin_amount.view", "Client")
      : Promise.resolve([]),
  ]);
  const budgets = await prisma.budget.findMany({
    where: { companyId, ...scopeWhere },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true },
  });
  const visibleBudgets = budgets.filter((budget) => {
    const filterMatch =
      activeFilter === "todos" ||
      (activeFilter === "pendientes" &&
        [
          "borrador",
          "pendiente_revision",
          "pendiente_respuesta",
          "enviado",
          "visto",
        ].includes(budget.estado)) ||
      budget.estado === activeFilter;
    const search = normalize(query.buscar ?? "");
    const text = normalize(
      `${budget.numero} ${budget.titulo} ${budget.client.nombre} ${budget.work?.titulo ?? ""}`,
    );
    return filterMatch && (!search || text.includes(search));
  });
  const pending = budgets.filter((budget) =>
    [
      "borrador",
      "pendiente_revision",
      "pendiente_respuesta",
      "enviado",
      "visto",
    ].includes(budget.estado),
  );
  const accepted = budgets.filter((budget) => budget.estado === "aceptado");
  const totalAccepted = accepted.reduce(
    (sum, budget) =>
      sum +
      (pricingDecision.allowed &&
      relationAllowed(
        pricingDecision.scope,
        pricingWorkIds,
        pricingClientIds,
        budget,
      )
        ? budget.total
        : 0),
    0,
  );
  const hasCriteria = activeFilter !== "todos" || Boolean(query.buscar);
  const review = budgets.filter(
    (budget) => budget.estado === "pendiente_revision",
  );
  const sent = budgets.filter((budget) =>
    ["enviado", "visto", "pendiente_respuesta"].includes(budget.estado),
  );
  const drafts = budgets.filter((budget) => budget.estado === "borrador");
  const acceptedRate = budgets.length
    ? Math.round((accepted.length / budgets.length) * 100)
    : 0;
  const latestBudget = visibleBudgets[0] ?? null;

  return (
    <ListWorkspace>
      <ModuleHeader
        eyebrow="Ventas"
        title="Presupuestos"
        description="Prepara, revisa y convierte propuestas con estado, alcance y trazabilidad siempre visibles."
        action={
          <>
            <Link href="/presupuestos/plantillas" className="secondary-button">
              <FileText size={18} /> Plantillas
            </Link>
            {createDecision.allowed && pricingDecision.allowed ? (
              <DemoLimitButton
                href="/gestion?tipo=presupuesto&returnTo=/presupuestos"
                currentCount={budgets.length}
                limit={2}
              >
                <Plus size={18} /> Nuevo presupuesto
              </DemoLimitButton>
            ) : null}
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          label="Total"
          value={String(budgets.length)}
          detail="Presupuestos visibles, en cualquier estado"
          icon={FileText}
        />
        <KpiCard
          label="Pendientes de aprobación"
          value={String(review.length)}
          detail={
            review.length
              ? "Requieren una decisión del equipo"
              : "No hay revisiones pendientes"
          }
          icon={Clock3}
          tone={pending.length ? "warning" : "neutral"}
        />
        <KpiCard
          label="Aceptados"
          value={String(accepted.length)}
          detail={`${acceptedRate}% del total registrado`}
          icon={CheckCircle2}
          tone="success"
        />
        {pricingDecision.allowed ? (
          <KpiCard
            label="Valor aceptado"
            value={formatCurrency(totalAccepted)}
            detail="Importe autorizado dentro de tu alcance"
            icon={CircleDollarSign}
            tone="accent"
          />
        ) : (
          <KpiCard
            label="Valor comercial"
            value="Restringido"
            detail="Importes protegidos por permisos"
            icon={CircleDollarSign}
          />
        )}
      </KpiGrid>

      <CompactFilterBar className="mb-4">
        <form
          action="/presupuestos"
          className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]"
        >
          <input type="hidden" name="filtro" value={activeFilter} />
          <label>
            <span className="label mb-1 block">Buscar</span>
            <CompactSearch
              name="buscar"
              defaultValue={query.buscar ?? ""}
              placeholder="Número, cliente, trabajo o título…"
            />
          </label>
          <button className="primary-button self-end" type="submit">
            <Search size={18} /> Buscar
          </button>
        </form>
        <CompactTabs label="Estados de presupuesto">
          {filters.map(([id, label]) => (
            <Link
              key={id}
              href={budgetHref(id, query.buscar)}
              aria-current={activeFilter === id ? "page" : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-bold ${activeFilter === id ? "bg-obra-ink text-white" : "text-slate-600 hover:bg-white"}`}
            >
              {label}
            </Link>
          ))}
        </CompactTabs>
      </CompactFilterBar>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)]">
        <ModulePanel
          title="Embudo de conversión"
          description="Volumen real por estado"
        >
          <div className="grid gap-4 p-4">
            <RatioRow
              label="Borrador"
              value={
                budgets.length ? (drafts.length / budgets.length) * 100 : 0
              }
              amount={`${drafts.length} propuestas`}
              tone="blue"
            />
            <RatioRow
              label="En revisión"
              value={
                budgets.length ? (review.length / budgets.length) * 100 : 0
              }
              amount={`${review.length} propuestas`}
              tone="orange"
            />
            <RatioRow
              label="Enviados y seguimiento"
              value={budgets.length ? (sent.length / budgets.length) * 100 : 0}
              amount={`${sent.length} propuestas`}
              tone="purple"
            />
            <RatioRow
              label="Aceptados"
              value={acceptedRate}
              amount={`${accepted.length} propuestas`}
              tone="green"
            />
          </div>
        </ModulePanel>

        <ModulePanel
          title="Último presupuesto visible"
          description="El más reciente dentro del resultado actual"
          action={
            latestBudget ? (
              <SoftBadge
                tone={
                  latestBudget.estado === "aceptado" ? "success" : "warning"
                }
              >
                {nextBudgetAction(latestBudget.estado)}
              </SoftBadge>
            ) : null
          }
        >
          {latestBudget ? (
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="type-label">{latestBudget.numero}</p>
                <h3 className="mt-1 text-lg font-bold text-obra-ink">
                  {latestBudget.titulo}
                </h3>
                <p className="type-secondary mt-1">
                  {latestBudget.client.nombre} ·{" "}
                  {latestBudget.work?.titulo ?? "Sin obra vinculada"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill status={latestBudget.estado} />
                  <SoftBadge>
                    Validez {formatDate(latestBudget.fechaValidez)}
                  </SoftBadge>
                  {marginDecision.allowed &&
                  relationAllowed(
                    marginDecision.scope,
                    marginWorkIds,
                    marginClientIds,
                    latestBudget,
                  ) ? (
                    <SoftBadge tone="accent">
                      Margen {budgetMarginLabel(latestBudget)}
                    </SoftBadge>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-44 flex-col justify-between rounded-xl bg-slate-50 p-4 text-right">
                <div>
                  <p className="type-label">Importe autorizado</p>
                  <p className="mt-1 text-xl font-bold text-obra-ink tabular-nums">
                    {pricingDecision.allowed &&
                    relationAllowed(
                      pricingDecision.scope,
                      pricingWorkIds,
                      pricingClientIds,
                      latestBudget,
                    )
                      ? formatCurrency(latestBudget.total)
                      : "Restringido"}
                  </p>
                </div>
                <Link
                  href={`/presupuestos/${latestBudget.id}`}
                  className="primary-button mt-4"
                >
                  Revisar propuesta <TrendingUp size={17} />
                </Link>
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm text-slate-500">
              No hay propuestas en el resultado actual.
            </p>
          )}
        </ModulePanel>
      </div>

      <ResultCount
        shown={visibleBudgets.length}
        total={budgets.length}
        noun="presupuestos"
        context={
          hasCriteria ? (
            <Link
              href="/presupuestos"
              className="font-bold text-obra-ink underline underline-offset-4"
            >
              Limpiar filtros
            </Link>
          ) : null
        }
      />

      {visibleBudgets.length ? (
        <>
          <ResponsiveTable
            label="Presupuestos"
            className="mt-4 overflow-hidden rounded-xl border border-slate-200"
          >
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Presupuesto
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Cliente y obra
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Importe
                  </th>
                  {marginDecision.allowed ? (
                    <th scope="col" className="px-4 py-3 text-right">
                      Margen
                    </th>
                  ) : null}
                  <th scope="col" className="px-4 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Próxima acción
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleBudgets.map((budget) => (
                  <tr
                    key={budget.id}
                    className={`${budget.id === latestBudget?.id ? "bg-emerald-50/60" : ""} align-middle hover:bg-slate-50/70`}
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/presupuestos/${budget.id}`}
                        className="font-black text-obra-ink hover:underline"
                      >
                        {budget.numero}
                      </Link>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        {budget.titulo}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-obra-ink">
                        {budget.client.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {budget.work?.titulo ?? "Sin obra"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{formatDate(budget.fechaCreacion)}</p>
                      <p className="text-xs text-slate-500">
                        Validez {formatDate(budget.fechaValidez)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-black text-obra-ink">
                      {pricingDecision.allowed &&
                      relationAllowed(
                        pricingDecision.scope,
                        pricingWorkIds,
                        pricingClientIds,
                        budget,
                      )
                        ? formatCurrency(budget.total)
                        : "Restringido"}
                    </td>
                    {marginDecision.allowed ? (
                      <td className="px-4 py-4 text-right font-bold text-slate-700">
                        {relationAllowed(
                          marginDecision.scope,
                          marginWorkIds,
                          marginClientIds,
                          budget,
                        )
                          ? budgetMarginLabel(budget)
                          : "Restringido"}
                      </td>
                    ) : null}
                    <td className="px-4 py-4">
                      <StatusPill status={budget.estado} />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {nextBudgetAction(budget.estado)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/presupuestos/${budget.id}`}
                        className="secondary-button"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>

          <MobileList className="mt-4">
            {visibleBudgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                permissions={{
                  update:
                    updateDecision.allowed &&
                    relationAllowed(
                      updateDecision.scope,
                      updateWorkIds,
                      updateClientIds,
                      budget,
                    ) &&
                    pricingDecision.allowed &&
                    relationAllowed(
                      pricingDecision.scope,
                      pricingWorkIds,
                      pricingClientIds,
                      budget,
                    ),
                  duplicate:
                    createDecision.allowed &&
                    relationAllowed(
                      createDecision.scope,
                      createWorkIds,
                      createClientIds,
                      budget,
                    ) &&
                    pricingDecision.allowed &&
                    relationAllowed(
                      pricingDecision.scope,
                      pricingWorkIds,
                      pricingClientIds,
                      budget,
                    ),
                  agenda:
                    agendaDecision.allowed &&
                    relationAllowed(
                      agendaDecision.scope,
                      agendaWorkIds,
                      agendaClientIds,
                      budget,
                    ),
                  pricing:
                    pricingDecision.allowed &&
                    relationAllowed(
                      pricingDecision.scope,
                      pricingWorkIds,
                      pricingClientIds,
                      budget,
                    ),
                  margin:
                    marginDecision.allowed &&
                    relationAllowed(
                      marginDecision.scope,
                      marginWorkIds,
                      marginClientIds,
                      budget,
                    ),
                }}
              />
            ))}
          </MobileList>
        </>
      ) : (
        <div className="mt-4">
          <EmptyState
            title={
              hasCriteria
                ? "No hay presupuestos para estos filtros"
                : "Todavía no hay presupuestos"
            }
            description={
              hasCriteria
                ? "Prueba otra búsqueda o limpia los filtros activos."
                : "Crea el primer presupuesto para empezar a seguir propuestas y respuestas."
            }
            icon={Search}
            action={
              hasCriteria ? (
                <Link href="/presupuestos" className="secondary-button">
                  Limpiar filtros
                </Link>
              ) : createDecision.allowed &&
                createDecision.scope === "COMPANY" &&
                pricingDecision.allowed &&
                pricingDecision.scope === "COMPANY" ? (
                <DemoLimitButton
                  href="/gestion?tipo=presupuesto&returnTo=/presupuestos"
                  currentCount={budgets.length}
                  limit={2}
                >
                  Crear presupuesto
                </DemoLimitButton>
              ) : undefined
            }
          />
        </div>
      )}
    </ListWorkspace>
  );
}

function BudgetCard({
  budget,
  permissions,
}: {
  budget: Awaited<ReturnType<typeof prisma.budget.findMany>>[number] & {
    client: { nombre: string };
    work: { titulo: string } | null;
  };
  permissions: {
    update: boolean;
    duplicate: boolean;
    agenda: boolean;
    pricing: boolean;
    margin: boolean;
  };
}) {
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{budget.numero}</p>
          <h2 className="mt-1 truncate text-lg font-black text-obra-ink">
            {budget.titulo}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {budget.client.nombre}
            {budget.work ? ` · ${budget.work.titulo}` : ""}
          </p>
        </div>
        <StatusPill status={budget.estado} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {permissions.pricing ? (
          <Mini label="Total" value={formatCurrency(budget.total)} />
        ) : null}
        {permissions.margin ? (
          <Mini label="Margen" value={budgetMarginLabel(budget)} />
        ) : null}
        <Mini label="Validez" value={formatDate(budget.fechaValidez)} />
        <Mini label="Creado" value={formatDate(budget.fechaCreacion)} />
        <Mini label="Siguiente" value={nextBudgetAction(budget.estado)} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/presupuestos/${budget.id}`}
          className="primary-button flex-1"
        >
          Abrir detalle
        </Link>
        <ActionMenu>
          {permissions.update ? (
            <Link
              href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/presupuestos`}
            >
              <Pencil size={17} /> Editar
            </Link>
          ) : null}
          {permissions.agenda ? (
            <Link
              href={`/gestion?tipo=eventoAgenda&clienteId=${budget.clienteId}&presupuestoId=${budget.id}&tipoEvento=seguimiento_presupuesto&titulo=Seguimiento%20${encodeURIComponent(budget.numero)}&returnTo=/presupuestos`}
            >
              <MessageCircle size={17} /> Seguimiento
            </Link>
          ) : null}
          {permissions.duplicate ? (
            <form action={duplicateBudget}>
              <input type="hidden" name="id" value={budget.id} />
              <ConfirmSubmitButton message="¿Duplicar este presupuesto como borrador editable?">
                <Copy size={17} /> Duplicar
              </ConfirmSubmitButton>
            </form>
          ) : null}
          {permissions.pricing ? (
            <Link
              href={`/presupuestos/${budget.id}/pdf?preview=1`}
              target="_blank"
            >
              <Eye size={17} /> Vista PDF
            </Link>
          ) : null}
          {permissions.pricing ? (
            <Link href={`/presupuestos/${budget.id}/pdf`}>
              <Download size={17} /> Descargar
            </Link>
          ) : null}
        </ActionMenu>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 font-black text-obra-ink">{value}</p>
    </div>
  );
}
function budgetMarginLabel(budget: {
  subtotal: number;
  margenEstimado: number;
}) {
  if (budget.subtotal <= 0) return "Datos insuficientes";
  const percent = (budget.margenEstimado / budget.subtotal) * 100;
  return `${percent.toFixed(1)} % · ${formatCurrency(budget.margenEstimado)}`;
}
function nextBudgetAction(status: string) {
  if (["borrador", "pendiente_revision"].includes(status))
    return "Revisar y enviar";
  if (["enviado", "visto", "pendiente_respuesta"].includes(status))
    return "Preparar seguimiento";
  if (status === "aceptado") return "Convertir o ejecutar";
  if (status === "caducado") return "Actualizar validez";
  if (status === "rechazado") return "Revisar propuesta";
  return "Revisar";
}
function budgetHref(filter: string, search?: string) {
  const params = new URLSearchParams();
  if (filter !== "todos") params.set("filtro", filter);
  if (search) params.set("buscar", search);
  const suffix = params.toString();
  return suffix ? `/presupuestos?${suffix}` : "/presupuestos";
}
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function relationScope(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS")
    return { clienteId: { in: clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length)
    OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}
function relationAllowed(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
  entity: { obraId: string | null; clienteId: string },
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS")
    return Boolean(entity.obraId && workIds?.includes(entity.obraId));
  if (scope === "SELECTED_CLIENTS")
    return Boolean(clientIds?.includes(entity.clienteId));
  return entity.obraId
    ? Boolean(workIds?.includes(entity.obraId))
    : Boolean(clientIds?.includes(entity.clienteId));
}
