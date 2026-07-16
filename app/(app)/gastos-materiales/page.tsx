import Link from "next/link";
import { FileScan, PackageCheck, Pencil, Plus, ReceiptText } from "lucide-react";
import { updateMaterialStatus } from "@/app/(app)/gastos-materiales/actions";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ExpensesMaterialsPage({
  searchParams
}: {
  searchParams: Promise<{ filtro?: string; buscar?: string }>;
}) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const [expenses, materials] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId },
      orderBy: { fecha: "desc" },
      include: { work: { include: { client: true } } }
    }),
    prisma.material.findMany({
      where: { companyId },
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
      include: { work: { include: { client: true } } }
    })
  ]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.importe, 0);
  const visibleMaterials = materials.filter((material) => {
    const filterMatch = query.filtro !== "pendientes" || ["pendiente", "falta"].includes(material.estado);
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${material.nombre} ${material.cantidad} ${material.estado} ${material.work.titulo} ${material.notas ?? ""}`);
    return filterMatch && (!search || text.includes(search));
  });
  const visibleExpenses = expenses.filter((expense) => {
    const search = normalize(query.buscar ?? "");
    const text = normalize(`${expense.concepto} ${expense.proveedor} ${expense.categoria} ${expense.work?.titulo ?? "Gasto general"} ${expense.notas ?? ""}`);
    return !search || text.includes(search);
  });

  return (
    <main className="screen">
      <SectionHeader
        title="Gastos y materiales"
        description="Tickets, compras y faltas por obra."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/gastos-materiales/lector" className="primary-button">
              <FileScan size={18} />
              Leer factura o ticket
            </Link>
            <Link href="/gestion?tipo=gasto&returnTo=/gastos-materiales" className="secondary-button">
              <Plus size={18} />
              Gasto
            </Link>
            <Link href="/gestion?tipo=material&returnTo=/gastos-materiales" className="secondary-button">
              <Plus size={18} />
              Material
            </Link>
          </div>
        }
      />

      <form action="/gastos-materiales" className="card mb-3 flex gap-2 p-3">
        <input type="hidden" name="filtro" value={query.filtro ?? "todos"} />
        <input className="field" name="buscar" defaultValue={query.buscar ?? ""} placeholder="Buscar cemento cola, proveedor, obra..." />
        <button type="submit" className="secondary-button shrink-0">Buscar</button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Link href="/gastos-materiales" className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${!query.filtro ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>Todo</Link>
        <Link href="/gastos-materiales?filtro=pendientes" className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${query.filtro === "pendientes" ? "bg-obra-ink text-white" : "border border-slate-200 bg-white text-obra-ink"}`}>Pendientes</Link>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <ReceiptText size={22} className="text-obra-yellowDark" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Gasto registrado</p>
          <p className="mt-1 text-2xl font-black text-obra-ink">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <PackageCheck size={22} className="text-obra-orange" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Material pendiente</p>
          <p className="mt-1 text-2xl font-black text-obra-ink">
            {materials.filter((material) => ["pendiente", "falta"].includes(material.estado)).length}
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-black text-obra-ink">Materiales</h2>
        <div className="grid gap-3">
          {visibleMaterials.map((material) => (
            <article key={material.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-obra-ink">{material.nombre}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {material.cantidad} · {material.work.titulo}
                  </p>
                </div>
                <StatusPill status={material.estado} />
              </div>
              {material.notas ? <p className="mt-3 text-sm leading-6 text-slate-600">{material.notas}</p> : null}
              <Link href={`/gestion?tipo=material&id=${material.id}&returnTo=/gastos-materiales`} className="secondary-button mt-3">
                <Pencil size={18} />
                Editar
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                <MaterialStatusButton id={material.id} estado="comprado" label="Comprado" />
                <MaterialStatusButton id={material.id} estado="entregado" label="Entregado" />
                <MaterialStatusButton id={material.id} estado="falta" label="Falta" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-obra-ink">Gastos recientes</h2>
        <div className="grid gap-3">
          {visibleExpenses.map((expense) => (
            <article key={expense.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-obra-ink">{expense.concepto}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {expense.proveedor} · {expense.work?.titulo ?? "Gasto general"}
                  </p>
                </div>
                <p className="text-base font-black text-obra-ink">{formatCurrency(expense.importe)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <StatusPill status={expense.categoria} />
                <span>{statusLabel(expense.categoria)}</span>
                <span>{formatDate(expense.fecha)}</span>
              </div>
              <Link href={`/gestion?tipo=gasto&id=${expense.id}&returnTo=/gastos-materiales`} className="secondary-button mt-3">
                <Pencil size={18} />
                Editar
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function MaterialStatusButton({ id, estado, label }: { id: string; estado: string; label: string }) {
  return (
    <form action={updateMaterialStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className="secondary-button">
        {label}
      </button>
    </form>
  );
}
