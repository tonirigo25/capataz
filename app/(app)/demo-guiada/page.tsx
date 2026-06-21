import Link from "next/link";
import { CheckCircle2, Circle, Play, RotateCcw } from "lucide-react";
import { runGuidedDemoStep } from "@/app/(app)/demo-guiada/actions";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const flowIds = {
  client: "flow-client-bano",
  visit: "flow-visit-bano",
  budget: "flow-budget-bano",
  budgetFollowUp: "flow-budget-follow-up",
  work: "flow-work-bano",
  expense: "flow-expense-bano",
  material: "flow-material-bano",
  invoice: "flow-invoice-bano",
  partialPayment: "flow-payment-partial",
  finalPayment: "flow-payment-final",
  collectionReminder: "flow-collection-reminder"
};

const steps = [
  "Nuevo lead",
  "Datos del cliente",
  "Visita",
  "Presupuesto",
  "Seguimiento",
  "Obra",
  "Gastos/materiales",
  "Factura",
  "Cobro parcial",
  "Recordatorio",
  "Pago final",
  "Cierre"
];

export default async function GuidedDemoPage() {
  const state = await getFlowState();
  const completed = completionFlags(state);
  const completedCount = completed.filter(Boolean).length;
  const nextStep = Math.min(completedCount + 1, steps.length);

  return (
    <main className="screen">
      <SectionHeader
        title="Demo guiada"
        description="Recorre el flujo completo: lead, visita, presupuesto, obra, factura, cobros y cierre."
        action={
          <form action={runGuidedDemoStep}>
            <input type="hidden" name="step" value="0" />
            <button type="submit" className="secondary-button">
              <RotateCcw size={18} />
              Reiniciar
            </button>
          </form>
        }
      />

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500">Progreso</p>
            <h1 className="text-2xl font-black text-obra-ink">Paso {Math.min(nextStep, 12)} de 12</h1>
          </div>
          <span className="rounded-full bg-obra-yellow px-3 py-1 text-sm font-black text-obra-ink">{completedCount}/12</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-obra-yellowDark" style={{ width: `${Math.round((completedCount / 12) * 100)}%` }} />
        </div>
      </section>

      <section className="grid gap-3">
        {steps.map((title, index) => {
          const stepNumber = index + 1;
          const done = completed[index];
          const current = stepNumber === nextStep && !done;
          return (
            <article key={title} className={`card p-4 ${current ? "border-obra-yellowDark" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${done ? "bg-obra-green/10 text-obra-green" : "bg-slate-100 text-slate-500"}`}>
                    {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Paso {stepNumber}</p>
                    <h2 className="text-base font-black text-obra-ink">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{descriptionFor(stepNumber, state)}</p>
                  </div>
                </div>
                {done ? <StatusPill status="programado" /> : null}
              </div>

              {current ? (
                <form action={runGuidedDemoStep} className="mt-4">
                  <input type="hidden" name="step" value={stepNumber} />
                  <button type="submit" className="primary-button w-full">
                    <Play size={18} />
                    Ejecutar paso
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid gap-3">
        <h2 className="text-lg font-black text-obra-ink">Datos creados en la demo</h2>
        <div className="card divide-y divide-slate-100">
          <Link href={state.client ? `/clientes/${state.client.id}` : "/clientes"} className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-obra-ink">Cliente</span>
            <span className="text-sm text-slate-600">{state.client?.nombre ?? "Pendiente"}</span>
          </Link>
          <Link href="/presupuestos" className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-obra-ink">Presupuesto</span>
            <span className="text-sm text-slate-600">{state.budget ? `${state.budget.numero} · ${state.budget.estado}` : "Pendiente"}</span>
          </Link>
          <Link href="/obras" className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-obra-ink">Obra</span>
            <span className="text-sm text-slate-600">{state.work ? `${state.work.titulo} · ${state.work.estado}` : "Pendiente"}</span>
          </Link>
          <Link href={state.invoice ? `/dinero/${state.invoice.id}` : "/dinero"} className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-obra-ink">Factura</span>
            <span className="text-sm text-slate-600">
              {state.invoice ? `${state.invoice.estado} · pendiente ${formatCurrency(state.invoice.pendiente)}` : "Pendiente"}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}

async function getFlowState() {
  const [client, visit, budget, budgetFollowUp, work, expense, material, invoice, partialPayment, finalPayment, collectionReminder] =
    await Promise.all([
      prisma.client.findUnique({ where: { id: flowIds.client } }),
      prisma.reminder.findUnique({ where: { id: flowIds.visit } }),
      prisma.budget.findUnique({ where: { id: flowIds.budget } }),
      prisma.reminder.findUnique({ where: { id: flowIds.budgetFollowUp } }),
      prisma.work.findUnique({ where: { id: flowIds.work } }),
      prisma.expense.findUnique({ where: { id: flowIds.expense } }),
      prisma.material.findUnique({ where: { id: flowIds.material } }),
      prisma.invoice.findUnique({ where: { id: flowIds.invoice } }),
      prisma.payment.findUnique({ where: { id: flowIds.partialPayment } }),
      prisma.payment.findUnique({ where: { id: flowIds.finalPayment } }),
      prisma.reminder.findUnique({ where: { id: flowIds.collectionReminder } })
    ]);

  return { client, visit, budget, budgetFollowUp, work, expense, material, invoice, partialPayment, finalPayment, collectionReminder };
}

function completionFlags(state: Awaited<ReturnType<typeof getFlowState>>) {
  return [
    Boolean(state.client),
    state.client?.estado !== "nuevo" && Boolean(state.client?.email),
    state.visit?.estado === "programado",
    Boolean(state.budget),
    state.budget?.estado === "pendiente_respuesta" && state.budgetFollowUp?.estado === "programado",
    Boolean(state.work),
    Boolean(state.expense && state.material),
    Boolean(state.invoice),
    Boolean(state.partialPayment && state.invoice && state.invoice.pendiente < state.invoice.total && state.invoice.pendiente > 0),
    state.collectionReminder?.estado === "programado",
    Boolean(state.finalPayment && state.invoice?.pendiente === 0),
    state.work?.estado === "cerrada"
  ];
}

function descriptionFor(step: number, state: Awaited<ReturnType<typeof getFlowState>>) {
  switch (step) {
    case 1:
      return state.client ? `${state.client.nombre} creado como lead desde llamada.` : "Crea un lead ficticio de reforma de baño.";
    case 2:
      return "Completa teléfono, email, dirección y estado del cliente.";
    case 3:
      return state.visit ? `Visita: ${formatDate(state.visit.fechaProgramada)}.` : "Agenda una visita para medir el baño.";
    case 4:
      return "Crea un presupuesto básico con partidas, IVA y total.";
    case 5:
      return "Marca el presupuesto como enviado y programa seguimiento confirmado.";
    case 6:
      return "Acepta el presupuesto y crea la obra asociada.";
    case 7:
      return "Registra gasto de material y añade material pendiente.";
    case 8:
      return "Crea factura asociada a la obra.";
    case 9:
      return "Registra pago parcial y recalcula pendiente.";
    case 10:
      return "Programa recordatorio de cobro con mensaje local.";
    case 11:
      return "Registra pago final y marca factura como pagada.";
    case 12:
      return "Cierra la obra cuando no queda pendiente crítico.";
    default:
      return "";
  }
}
