import { Activity, Building2, Check, CreditCard, Image, LockKeyhole, Save, Smartphone, UserRound, Users, Zap } from "lucide-react";
import { saveCompanySettings, saveUserProfile } from "@/app/(app)/configuracion/actions";
import { SectionHeader } from "@/components/section-header";
import { appModeDescription, appModeLabel, getAppMode, isUnlimitedMode } from "@/lib/app-mode";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { getSystemStatus } from "@/lib/system-status";

const limits = [
  "Máximo 3 clientes reales",
  "Máximo 2 presupuestos",
  "Máximo 1 obra activa",
  "Máximo 3 recordatorios programados",
  "PDFs con marca de agua Demo Capataz"
];

const nextSteps = [
  "Conectar WhatsApp Business con autorización explícita",
  "Añadir email transaccional y plantillas",
  "Generar PDFs de presupuestos y facturas",
  "Automatizar backups y observabilidad en PostgreSQL",
  "Activar Stripe y planes de suscripción",
  "Sustituir chat mock por IA real con herramientas"
];

const plans = [
  {
    name: "Demo",
    price: "0 €",
    icon: Smartphone,
    current: true,
    description: "Para probar Capataz con datos ficticios y límites freemium.",
    features: ["Datos demo incluidos", "Límites de clientes, obras y recordatorios", "PDFs con marca de agua"],
    action: "Plan actual"
  },
  {
    name: "Autónomo",
    price: "19 €/mes",
    icon: Users,
    current: false,
    description: "Para profesionales que quieren llevar clientes reales, cobros y seguimientos.",
    features: ["Clientes y obras reales", "Presupuestos y facturas sin límite demo", "Recordatorios de seguimiento"],
    action: "Activar cuando esté disponible"
  },
  {
    name: "Pro",
    price: "49 €/mes",
    icon: Zap,
    current: false,
    description: "Para equipos pequeños con más volumen y control operativo.",
    features: ["Multiusuario en fase futura", "Automatizaciones avanzadas con confirmación", "Informes y exportación avanzada"],
    action: "Solicitar acceso"
  }
];

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [company, profile, systemStatus] = await Promise.all([
    prisma.empresa.findFirst(),
    prisma.usuarioPerfil.findFirst(),
    getSystemStatus()
  ]);
  const mode = getAppMode();
  const unlimited = isUnlimitedMode(mode);
  const profileStatus = profileCompletion(profile);
  const companyStatus = companyCompletion(company);

  return (
    <main className="screen">
      <SectionHeader title="Configuración" description="Tu trato personal, datos de empresa, app móvil, límites y planes." />

      <section className="card mb-5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <Smartphone size={22} />
          </span>
          <div>
            <h1 className="text-lg font-black text-obra-ink">{appModeLabel(mode)}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">{appModeDescription(mode)}</p>
          </div>
        </div>
        <div className={`mt-4 rounded-lg p-3 text-sm font-semibold leading-6 ${unlimited ? "bg-obra-green/10 text-obra-green" : "bg-obra-yellow/20 text-obra-yellowDark"}`}>
          {unlimited
            ? "El propietario/desarrollador puede crear clientes, obras, presupuestos, facturas, recordatorios y PDFs sin bloqueos."
            : "La demo pública mantiene límites comerciales y marca de agua en PDFs."}
        </div>
      </section>

      <section id="sistema" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <Activity size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Estado del sistema</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Comprobación básica de entorno, API interna y conexión de datos. No muestra secretos ni la URL de base de datos.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SystemItem label="Entorno" value={systemStatus.appEnv} />
          <SystemItem label="Modo" value={systemStatus.appMode} />
          <SystemItem label="URL web" value={systemStatus.webBaseUrl} />
          <SystemItem label="API interna" value={systemStatus.internalApiPath} status="ok" />
          <SystemItem label="Prisma / PostgreSQL" value={systemStatus.database === "ok" ? "Conectado" : "Revisar conexión"} status={systemStatus.database} />
          <SystemItem label="Backend móvil" value={systemStatus.mobileServerConfigured ? "Configurado" : "Pendiente"} status={systemStatus.mobileServerConfigured ? "ok" : "warning"} />
        </div>

        {systemStatus.missingPublicVars.length || systemStatus.missingRecommendedVars.length ? (
          <div className="mt-3 rounded-lg bg-obra-yellow/20 p-3 text-sm font-semibold leading-6 text-obra-yellowDark">
            Faltan variables: {[...systemStatus.missingPublicVars, ...systemStatus.missingRecommendedVars].join(", ")}.
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-obra-green/10 p-3 text-sm font-semibold text-obra-green">
            Variables principales configuradas.
          </div>
        )}
      </section>

      <section id="perfil" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <UserRound size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Mi perfil</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Datos de la persona que usa Capataz. Sirven para que el chat te trate por tu nombre, no para documentos fiscales.
            </p>
          </div>
        </div>

        <CompletionBar label="Perfil" status={profileStatus} />

        <form action={saveUserProfile} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={profile?.id ?? "usuario-demo"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="nombre" label="Nombre" value={profile?.nombre ?? ""} />
            <Field name="apellidos" label="Apellidos" value={profile?.apellidos ?? ""} />
            <Field name="nombrePreferido" label="Nombre preferido" value={profile?.nombrePreferido ?? ""} />
            <Field name="telefono" label="Teléfono personal" value={profile?.telefono ?? ""} />
            <Field name="email" label="Email personal" value={profile?.email ?? ""} type="email" />
            <Field name="cargo" label="Cargo" value={profile?.cargo ?? ""} />
            <Field name="oficioPrincipal" label="Oficio principal" value={profile?.oficioPrincipal ?? ""} />
            <label>
              <span className="label mb-1 block">Tono preferido</span>
              <select className="field" name="tonoPreferido" defaultValue={profile?.tonoPreferido ?? "directo"}>
                <option value="cercano">Cercano</option>
                <option value="formal">Formal</option>
                <option value="directo">Directo</option>
                <option value="muy_educado">Muy educado</option>
              </select>
            </label>
          </div>

          <button type="submit" className="primary-button w-full">
            <Save size={18} />
            Guardar mi perfil
          </button>
        </form>
      </section>

      <section id="empresa" className="card mb-5 scroll-mt-24 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <Building2 size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Datos de empresa</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Datos fiscales y de marca para presupuestos, facturas, PDFs y comunicaciones futuras.
            </p>
          </div>
        </div>

        <CompletionBar label="Empresa" status={companyStatus} />

        <form action={saveCompanySettings} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={company?.id ?? "empresa-demo"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="nombreComercial" label="Nombre comercial" value={company?.nombreComercial ?? ""} required />
            <Field name="razonSocial" label="Razón social" value={company?.razonSocial ?? ""} />
            <Field name="nifCif" label="NIF/CIF" value={company?.nifCif ?? ""} />
            <Field name="telefono" label="Teléfono" value={company?.telefono ?? ""} />
            <Field name="email" label="Email" value={company?.email ?? ""} type="email" />
            <Field name="web" label="Web" value={company?.web ?? ""} />
            <Field name="direccionFiscal" label="Dirección fiscal" value={company?.direccionFiscal ?? ""} />
            <Field name="codigoPostal" label="Código postal" value={company?.codigoPostal ?? ""} />
            <Field name="ciudad" label="Ciudad" value={company?.ciudad ?? ""} />
            <Field name="provincia" label="Provincia" value={company?.provincia ?? ""} />
            <Field name="pais" label="País" value={company?.pais ?? "España"} />
            <Field name="personaContacto" label="Persona contacto" value={company?.personaContacto ?? ""} />
            <Field name="iban" label="IBAN / datos bancarios" value={company?.iban ?? ""} />
            <Field name="colorMarca" label="Color marca" value={company?.colorMarca ?? "#f6c945"} type="color" />
            <Field name="ivaDefecto" label="IVA por defecto" value={company?.ivaDefecto ?? 21} type="number" />
            <Field name="seriePresupuestos" label="Serie presupuestos" value={company?.seriePresupuestos ?? "2026"} />
            <Field name="serieFacturas" label="Serie facturas" value={company?.serieFacturas ?? "2026"} />
            <Field name="prefijoPresupuesto" label="Prefijo presupuesto" value={company?.prefijoPresupuesto ?? "P"} />
            <Field name="prefijoFactura" label="Prefijo factura" value={company?.prefijoFactura ?? "F"} />
          </div>
          <Field name="logoUrl" label="Logo URL o ruta local" value={company?.logoUrl ?? ""} />
          <Field name="selloUrl" label="Sello URL o ruta local" value={company?.selloUrl ?? ""} />
          <Textarea name="condicionesPorDefecto" label="Condiciones por defecto" value={company?.condicionesPorDefecto ?? ""} />
          <Textarea name="textoLegal" label="Texto legal" value={company?.textoLegal ?? ""} />

          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewAsset title="Logo" url={company?.logoUrl} />
            <PreviewAsset title="Sello" url={company?.selloUrl} />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            Previsualización documento: {company?.nombreComercial ?? "Mi empresa"} · {company?.nifCif ?? "NIF/CIF pendiente"} · serie presupuesto {company?.prefijoPresupuesto ?? "P"}-{company?.seriePresupuestos ?? "2026"}.
          </div>

          <button type="submit" className="primary-button w-full">
            <Save size={18} />
            Guardar datos de empresa
          </button>
        </form>
      </section>

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Smartphone size={20} className="text-obra-graphite" />
          <h2 className="text-lg font-black text-obra-ink">Usar Capataz como app</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">iPhone</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Capataz en Safari.</li>
              <li>Pulsa compartir.</li>
              <li>Pulsa Añadir a pantalla de inicio.</li>
              <li>Abre Capataz desde el icono.</li>
            </ol>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">Android</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Capataz en Chrome.</li>
              <li>Pulsa el menú.</li>
              <li>Pulsa Instalar app o Añadir a pantalla de inicio.</li>
              <li>Abre Capataz desde el icono.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="card mb-5 p-4">
        <h2 className="text-lg font-black text-obra-ink">Legal y soporte</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Información necesaria para usuarios, revisores de App Store y Google Play.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <a href="/privacidad" className="secondary-button">Privacidad</a>
          <a href="/terminos" className="secondary-button">Términos</a>
          <a href="/cookies" className="secondary-button">Cookies</a>
          <a href="/politicas" className="secondary-button">Políticas</a>
          <a href="/soporte" className="secondary-button">Soporte</a>
        </div>
      </section>

      <section id="suscripcion" className="mb-5 scroll-mt-24">
        <h2 className="mb-3 text-lg font-black text-obra-ink">Suscripción</h2>
        <div className="grid gap-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <article key={plan.name} className={`card p-4 ${plan.current ? "border-obra-yellowDark" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-obra-ink">{plan.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{plan.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-lg font-black text-obra-ink">{plan.price}</span>
                </div>

                <div className="mt-4 grid gap-2">
                  {plan.features.map((feature) => (
                    <p key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                      <Check size={17} className="mt-0.5 shrink-0 text-obra-green" />
                      {feature}
                    </p>
                  ))}
                </div>

                <button type="button" className={plan.current ? "secondary-button mt-4 w-full" : "primary-button mt-4 w-full"}>
                  {plan.action}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <LockKeyhole size={20} className="text-obra-graphite" />
          <h2 className="text-lg font-black text-obra-ink">Límites freemium demo</h2>
        </div>
        <div className="grid gap-2">
          {limits.map((item) => (
            <p key={item} className="flex items-center gap-2 text-sm text-slate-600">
              <Check size={17} className="text-obra-green" />
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={20} className="text-obra-graphite" />
          <h2 className="text-lg font-black text-obra-ink">Arquitectura preparada</h2>
        </div>
        <div className="grid gap-2">
          {nextSteps.map((item) => (
            <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
              <Check size={17} className="mt-0.5 shrink-0 text-obra-yellowDark" />
              {item}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  required = false
}: {
  name: string;
  label: string;
  value: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} />
    </label>
  );
}

function CompletionBar({
  label,
  status
}: {
  label: string;
  status: { percent: number; missingRequired: string[]; missingRecommended: string[] };
}) {
  const missing = [...status.missingRequired, ...status.missingRecommended];

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-obra-ink">{label} completo al {status.percent}%</p>
        <span className="text-xs font-bold text-slate-500">{missing.length} pendientes</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-obra-yellowDark" style={{ width: `${status.percent}%` }} />
      </div>
      {missing.length ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
          Falta: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? "..." : ""}.
        </p>
      ) : (
        <p className="mt-2 text-xs font-semibold text-obra-green">Datos listos para trabajar.</p>
      )}
    </div>
  );
}

function SystemItem({
  label,
  value,
  status = "neutral"
}: {
  label: string;
  value: string;
  status?: "ok" | "error" | "warning" | "neutral";
}) {
  const tone =
    status === "ok"
      ? "bg-obra-green/10 text-obra-green"
      : status === "error"
        ? "bg-obra-red/10 text-obra-red"
        : status === "warning"
          ? "bg-obra-yellow/20 text-obra-yellowDark"
          : "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg p-3 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-normal opacity-80">{label}</p>
      <p className="mt-1 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function Textarea({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <textarea className="field min-h-24 py-3 leading-6" name={name} defaultValue={value} />
    </label>
  );
}

function PreviewAsset({ title, url }: { title: string; url?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-obra-ink">
        <Image size={18} className="text-obra-yellowDark" />
        {title}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="h-16 max-w-full rounded-lg border border-slate-100 object-contain p-2" />
      ) : (
        <p className="text-sm text-slate-500">Sin imagen configurada.</p>
      )}
    </div>
  );
}
