import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Gauge,
  KeyRound,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

export type ConfigurationOverviewData = {
  owner: boolean;
  companyName: string;
  planName: string;
  accountStatus: string;
  members: number | null;
  memberLimit: number | null;
  aiUsage: number | null;
  aiLimit: number | null;
  aiEnabled: boolean;
  mfaEnabled: boolean;
  profilePercent: number;
  companyPercent: number | null;
  capabilityCount: number;
};

export function ConfigurationOverview({ data }: { data: ConfigurationOverviewData }) {
  return (
    <section className="mb-5 space-y-4" aria-labelledby="configuration-overview-title" data-configuration-overview>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Gauge} label="Plan activo" value={data.planName} detail={data.owner ? "Consulta límites y estado comercial" : "Visible según tu acceso"} tone="green" />
        <SummaryCard icon={UsersRound} label="Usuarios incluidos" value={data.members == null ? "Restringido" : data.memberLimit == null ? String(data.members) : `${data.members} de ${data.memberLimit}`} detail={data.members == null ? "Consulta limitada por tu rol" : "Miembros activos registrados"} tone="violet" progress={ratio(data.members, data.memberLimit)} />
        <SummaryCard icon={Sparkles} label="Operaciones IA este mes" value={data.aiUsage == null ? "Restringido" : data.aiLimit == null ? String(data.aiUsage) : `${data.aiUsage} / ${data.aiLimit}`} detail={data.aiEnabled ? "IA controlada habilitada" : "Proveedor fail-closed o modo manual"} tone="blue" progress={ratio(data.aiUsage, data.aiLimit)} />
        <SummaryCard icon={ShieldCheck} label="Estado de la cuenta" value={humanize(data.accountStatus)} detail={data.mfaEnabled ? "MFA activo en tu cuenta" : "Revisa la seguridad de acceso"} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]">
        <article className="card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="type-label">Cuenta y acceso</p><h2 id="configuration-overview-title" className="mt-2 text-xl font-black text-obra-ink">Configuración de {data.companyName}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Empresa, perfil, permisos, plan y controles quedan separados para evitar cambios accidentales.</p></div>
            {data.owner ? <Link href="/plan-y-uso" className="secondary-button shrink-0">Plan y uso <ArrowRight size={16} aria-hidden="true" /></Link> : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ConfigurationLink icon={CircleUserRound} title="Perfil personal" detail={`${data.profilePercent}% completado`} href="/configuracion?area=perfil#perfil" status={data.profilePercent === 100 ? "Listo" : "Revisar"} />
            {data.owner && data.companyPercent != null ? <ConfigurationLink icon={Building2} title="Empresa y documentos" detail={`${data.companyPercent}% completado`} href="/configuracion?area=empresa#empresa" status={data.companyPercent === 100 ? "Listo" : "Revisar"} /> : null}
            <ConfigurationLink icon={KeyRound} title="Permisos efectivos" detail={`${data.capabilityCount} capacidades para tu perfil`} href={data.owner ? "/equipo" : "/configuracion?area=perfil#perfil"} status="Servidor" />
            <ConfigurationLink icon={LockKeyhole} title="Seguridad" detail={data.mfaEnabled ? "Segundo factor configurado" : "Segundo factor pendiente"} href="/configuracion/seguridad" status={data.mfaEnabled ? "Activo" : "Revisar"} />
          </div>
        </article>

        <aside className="card overflow-hidden" aria-label="Configuración recomendada">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4"><Sparkles className="text-emerald-600" size={18} aria-hidden="true" /><h2 className="font-black text-obra-ink">Configuración recomendada</h2></div>
          <div className="p-4">
            <p className="text-sm leading-6 text-slate-600">Revisa sólo los controles que necesitan atención. Los cambios sensibles conservan permisos, confirmación y auditoría.</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <SafetyItem>Los módulos dependen del plan y del rol efectivo.</SafetyItem>
              <SafetyItem>La IA respeta presupuesto, allowlist y kill switch.</SafetyItem>
              <SafetyItem>Facturación y permisos sólo se gestionan desde sus flujos protegidos.</SafetyItem>
            </ul>
            <Link href="/configuracion?area=integraciones#integraciones" className="primary-button mt-5 w-full">Revisar integraciones</Link>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickArea icon={Blocks} title="Módulos y preferencias" description="Ajusta perfil, empresa, app y preferencias sin alterar reglas de negocio." links={[{ label: "Preferencias", href: "/configuracion/preferencias" }, { label: "App móvil", href: "/configuracion?area=app#app" }]} />
        <QuickArea icon={PlugZap} title="Integraciones" description="Consulta proveedores y privacidad desde sus pantallas seguras; no se presume ninguna conexión." links={[{ label: "IA y consumo", href: "/configuracion/ia" }, { label: "Privacidad", href: "/configuracion/privacidad" }]} />
        <QuickArea icon={ShieldCheck} title="Seguridad y auditoría" description="Segundo factor, sesiones y trazabilidad permanecen fuera de los formularios generales." links={[{ label: "Seguridad", href: "/configuracion/seguridad" }, ...(data.owner ? [{ label: "Auditoría", href: "/auditoria" }] : [])]} />
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone, progress }: { icon: typeof Gauge; label: string; value: string; detail: string; tone: "green" | "violet" | "blue"; progress?: number | null }) {
  const tones = { green: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", blue: "bg-sky-50 text-sky-700" };
  return <article className="card min-h-32 p-4"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={20} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-black text-obra-ink">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></div>{progress != null ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${Math.round(progress * 100)}% utilizado`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(progress * 100)}%` }} /></div> : null}</article>;
}

function ConfigurationLink({ icon: Icon, title, detail, href, status }: { icon: typeof Gauge; title: string; detail: string; href: string; status: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200 hover:bg-emerald-50/40"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700 group-hover:bg-white"><Icon size={19} aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-obra-ink">{title}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{detail}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{status}</span></Link>;
}

function QuickArea({ icon: Icon, title, description, links }: { icon: typeof Gauge; title: string; description: string; links: Array<{ label: string; href: string }> }) {
  return <article className="card p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={20} aria-hidden="true" /></span><h2 className="mt-4 font-black text-obra-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><div className="mt-4 flex flex-wrap gap-2">{links.map((link) => <Link key={link.href} href={link.href} className="secondary-button text-xs">{link.label}</Link>)}</div></article>;
}

function SafetyItem({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} aria-hidden="true" /><span>{children}</span></li>;
}

function ratio(value: number | null, limit: number | null) {
  if (value == null || limit == null || !Number.isFinite(limit) || limit <= 0) return null;
  return Math.min(Math.max(value / limit, 0), 1);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
