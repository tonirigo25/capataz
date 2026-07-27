import { saveBusinessOnboarding } from "./actions";
import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sectorProfiles } from "@/lib/business-profile/sectors";
import { resolveBusinessProfile } from "@/lib/business-profile/resolve-profile";
import { brand } from "@/lib/brand";
import Link from "next/link";
import { Check, Circle, Clock3, Upload } from "lucide-react";

type OnboardingState = {
  step?: number;
  mainGoal?: string;
  firstAction?: string;
  optionalSkipped?: boolean;
};

export default async function OnboardingPage() {
  const auth = await requireCompanyContext();
  if (!["OWNER", "ADMIN"].includes(auth.role)) {
    return (
      <main className="screen max-w-3xl">
        <p className="type-label">Configuración inicial</p>
        <h1 className="type-page-title mt-2">Onboarding de la empresa</h1>
        <p className="type-secondary mt-2">No tienes acceso para cambiar estos datos. Solo el propietario o una persona administradora puede hacerlo.</p>
        <Link className="primary-button mt-5" href="/hoy">Volver a mi portal</Link>
      </main>
    );
  }
  const [company, clientCount, budgetCount, documentCount] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }),
    prisma.client.count({ where: { companyId: auth.companyId, archivadoAt: null } }),
    prisma.budget.count({ where: { companyId: auth.companyId } }),
    prisma.document.count({ where: { companyId: auth.companyId, archivedAt: null } }),
  ]);
  const selected = resolveBusinessProfile(company);
  const state = (company.onboardingState ?? {}) as OnboardingState;
  const milestones = [
    { key: "company", label: "Empresa", detail: "Nombre, organización y sector", done: Boolean(company.nombreComercial && company.organizationType), href: "#empresa" },
    { key: "profile", label: "Perfil", detail: "Lenguaje y objetivo de trabajo", done: Boolean(company.sectorKey), href: "#perfil" },
    { key: "client", label: "Primer cliente", detail: clientCount ? `${clientCount} registrado${clientCount === 1 ? "" : "s"}` : "Añade una relación real", done: clientCount > 0, href: "/clientes?nuevo=1" },
    { key: "budget", label: "Primer presupuesto", detail: budgetCount ? `${budgetCount} registrado${budgetCount === 1 ? "" : "s"}` : "Prepara el primer borrador", done: budgetCount > 0, href: "/presupuestos" },
    { key: "document", label: "Primer documento", detail: documentCount ? `${documentCount} registrado${documentCount === 1 ? "" : "s"}` : "Carga o registra un documento", done: documentCount > 0, href: "/documentos" },
  ];
  const completed = milestones.filter((item) => item.done).length;

  return (
    <main className="screen">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="type-label">Primer valor · {completed} de 5 hitos</p>
          <h1 className="type-page-title mt-2">Pon {brand.productName} a trabajar en menos de 15 minutos</h1>
          <p className="type-secondary mt-2">Avanza con datos reales, guarda cuando quieras y continúa manualmente sin activar ningún provider.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <Clock3 size={18} />
          Objetivo: &lt;15 min
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="card h-fit p-3 lg:sticky lg:top-24" data-onboarding-milestones>
          <h2 className="type-section-title px-1">Tus cinco hitos</h2>
          <ol className="mt-3 grid gap-2">
            {milestones.map((item, index) => (
              <li key={item.key}>
                <Link href={item.href} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {item.done ? <Check size={16} /> : <Circle size={14} />}
                  </span>
                  <span>
                    <strong className="block text-sm text-obra-ink">{index + 1}. {item.label}</strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>

        <div className="min-w-0 space-y-5">
          <form action={saveBusinessOnboarding} className="grid gap-5">
            <section id="empresa" className="card scroll-mt-24 p-4">
              <p className="type-label">Hitos 1 y 2</p>
              <h2 className="type-section-title mt-2">Empresa y perfil operativo</h2>
              <p className="type-secondary mt-1">Estos datos adaptan el lenguaje. No crean clientes, importes ni documentos de ejemplo.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label><span className="label">Tipo de organización</span><select className="field mt-1" name="organizationType" defaultValue={company.organizationType ?? "COMPANY"}><option value="SELF_EMPLOYED">Autónomo</option><option value="COMPANY">Empresa</option></select></label>
                <label><span className="label">Sector</span><select className="field mt-1" name="sectorKey" defaultValue={company.sectorKey ?? selected.key}>{Object.values(sectorProfiles).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                <label className="sm:col-span-2"><span className="label">Nombre visible</span><input className="field mt-1" name="displayName" defaultValue={company.nombreComercial}/></label>
              </div>
            </section>
            <details id="perfil" className="card scroll-mt-24 p-4" open={!company.sectorKey}>
              <summary className="type-section-title cursor-pointer">Personalización opcional</summary>
              <p className="type-secondary mt-2">Opcional. Afinar el lenguaje no cambia reglas, permisos ni cálculos.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label><span className="label">Cómo llamas a un trabajo</span><input className="field mt-1" name="workSingular" defaultValue={selected.terminology.workSingular}/></label>
                <label><span className="label">En plural</span><input className="field mt-1" name="workPlural" defaultValue={selected.terminology.workPlural}/></label>
                <label className="sm:col-span-2"><span className="label">Objetivo principal</span><input className="field mt-1" name="mainGoal" defaultValue={state.mainGoal} placeholder="Ej. controlar cobros y organizar proyectos"/></label>
                <label className="sm:col-span-2"><span className="label">Primera acción</span><select className="field mt-1" name="firstAction" defaultValue={state.firstAction ?? "Crear un cliente"}><option>Crear un cliente</option><option>Preparar un presupuesto</option><option>Organizar mi agenda</option><option>Preguntar a Orqena</option></select></label>
              </div>
            </details>
            <input type="hidden" name="step" value="2"/>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button className="secondary-button" name="complete" value="false">Guardar y continuar después</button>
              <button className="secondary-button" name="complete" value="skip">Omitir lo opcional</button>
              <button className="primary-button" name="complete" value="true">Continuar</button>
            </div>
          </form>

          <section className="card p-4" data-onboarding-import>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Upload size={19} /></span>
              <div>
                <h2 className="type-section-title">Importar o seguir manualmente</h2>
                <p className="type-secondary mt-1">La importación sigue el ciclo previsualizar → aplicar → rollback. Nada se aplica al subir el archivo.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="secondary-button" href="/configuracion/importar">Importar con vista previa</Link>
              <Link className="secondary-button" href="/clientes?nuevo=1">Seguir en modo manual</Link>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-onboarding-later>
            <h2 className="font-black text-obra-ink">¿Prefieres hacerlo más tarde?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Puedes seguir trabajando manualmente. Los PDFs o automatizaciones mostrarán como pendientes los datos que falten y ningún provider se activará por omitir este paso.
            </p>
            <Link className="ghost-button mt-3" href="/hoy">Configurar más tarde</Link>
          </section>
        </div>
      </div>
    </main>
  );
}
