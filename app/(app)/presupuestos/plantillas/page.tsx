import Link from "next/link";
import { ArrowLeft, Copy, FileText, Plus } from "lucide-react";
import { createBudgetFromTemplate } from "@/app/(app)/presupuestos/actions";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { isUnlimitedMode } from "@/lib/app-mode";
import { budgetTemplates } from "@/lib/budget-templates";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BudgetTemplatesPage() {
  const { companyId } = await requireCompanyContext();
  const [clients, works, budgetCount] = await Promise.all([
    prisma.client.findMany({ where: { companyId }, orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ where: { companyId }, orderBy: { titulo: "asc" }, include: { client: true } }),
    prisma.budget.count({ where: { companyId } })
  ]);
  const groups = Array.from(new Set(budgetTemplates.map((template) => template.group)));
  const demoLimitReached = !isUnlimitedMode() && budgetCount >= 2;

  return (
    <main className="screen">
      <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink">
        <ArrowLeft size={18} />
        Presupuestos
      </Link>

      <section className="mb-5">
        <h1 className="text-2xl font-black text-obra-ink">Crear presupuesto desde plantilla</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Elige oficio, cliente y obra opcional. Las partidas se crean editables antes de enviar o generar PDF.
        </p>
      </section>

      <div className="grid gap-5">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-lg font-black text-obra-ink">{group}</h2>
            <div className="grid gap-3">
              {budgetTemplates.filter((template) => template.group === group).map((template) => (
                <form key={template.id} action={createBudgetFromTemplate} className="card grid gap-3 p-4">
                  <input type="hidden" name="templateId" value={template.id} />
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
                      <FileText size={19} />
                    </span>
                    <div>
                      <h3 className="font-black text-obra-ink">{template.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{template.description}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{template.lines.length} partidas editables</p>
                    </div>
                  </div>

                  <label>
                    <span className="label mb-1 block">Cliente</span>
                    <select className="field" name="clienteId" required defaultValue="">
                      <option value="">Seleccionar cliente</option>
                      {clients.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="label mb-1 block">Obra opcional</span>
                    <select className="field" name="obraId" defaultValue="">
                      <option value="">Sin obra asociada</option>
                      {works.map((work) => <option key={work.id} value={work.id}>{work.titulo} · {work.client.nombre}</option>)}
                    </select>
                  </label>

                  {demoLimitReached ? (
                    <DemoLimitButton className="primary-button w-full" currentCount={budgetCount} limit={2}>
                      Crear desde plantilla
                    </DemoLimitButton>
                  ) : (
                    <button type="submit" className="primary-button w-full">
                      <Plus size={18} />
                      Crear desde plantilla
                    </button>
                  )}
                  <button type="submit" className="secondary-button w-full">
                    <Copy size={18} />
                    Duplicar plantilla como presupuesto
                  </button>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
