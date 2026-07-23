import { Activity, Building2, Image as ImageIcon, Save, Smartphone, UserRound } from "lucide-react";
import { saveCompanySettings, saveUserProfile } from "@/app/(app)/configuracion/actions";
import { SectionHeader } from "@/components/section-header";
import { appModeDescription, appModeLabel, getAppMode, isUnlimitedMode } from "@/lib/app-mode";
import { companyCompletion, profileCompletion } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";
import { getSystemStatus } from "@/lib/system-status";
import { requireCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";


export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireCompanyContext();
  const [companyRecord, legacyProfile, systemStatus] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }),
    prisma.usuarioPerfil.findUnique({ where: { id: auth.userId } }),
    getSystemStatus()
  ]);
  const company = companySettingsView(companyRecord);
  const profile = legacyProfile ?? {
    id: auth.userId, nombre: auth.displayName, email: auth.email, apellidos: null, tratamiento: null,
    nombrePreferido: null, telefono: null, cargo: null, oficioPrincipal: null, idioma: "es-ES",
    zonaHoraria: "Europe/Madrid", preferenciaVisual: "sistema", notificacionesInternas: true,
    notificacionesEmail: false, tonoPreferido: "directo"
  };
  const mode = getAppMode();
  const unlimited = isUnlimitedMode(mode);
  const profileStatus = profileCompletion(profile);
  const companyStatus = companyCompletion(company);

  return (
    <main className="screen">
      <SectionHeader title="Configuración" description="Tu trato personal, datos de empresa, app móvil, límites y planes." />
      <nav aria-label="Secciones de configuración" className="sticky top-16 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-y border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:flex-wrap sm:border-0 sm:bg-transparent sm:px-0">
        <a href="#perfil" className="secondary-button min-h-10 shrink-0 px-3">Perfil</a>
        <a href="#empresa" className="secondary-button min-h-10 shrink-0 px-3">Empresa</a>
        <a href="#sistema" className="secondary-button min-h-10 shrink-0 px-3">Sistema</a>
        <a href="#suscripcion" className="secondary-button min-h-10 shrink-0 px-3">Administración</a>
      </nav>

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
          <SystemItem label="Datos" value={systemStatus.database === "ok" ? "Conectados" : "Revisar conexión"} status={systemStatus.database} />
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
              Datos de tu perfil personal. Se usan para personalizar la experiencia y no sustituyen los datos fiscales.
            </p>
          </div>
        </div>

        <CompletionBar label="Perfil" status={profileStatus} />

        <form action={saveUserProfile} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={profile?.id ?? "usuario-demo"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="nombre" label="Nombre" value={profile?.nombre ?? ""} />
            <Field name="apellidos" label="Apellidos" value={profile?.apellidos ?? ""} />
            <Field name="tratamiento" label="Tratamiento" value={profile?.tratamiento ?? ""} />
            <Field name="nombrePreferido" label="Nombre preferido" value={profile?.nombrePreferido ?? ""} />
            <Field name="telefono" label="Teléfono personal" value={profile?.telefono ?? ""} />
            <Field name="email" label="Email personal" value={profile?.email ?? ""} type="email" />
            <Field name="cargo" label="Cargo" value={profile?.cargo ?? ""} />
            <Field name="oficioPrincipal" label="Oficio principal" value={profile?.oficioPrincipal ?? ""} />
            <Field name="idioma" label="Idioma" value={profile?.idioma ?? "es-ES"} />
            <Field name="zonaHoraria" label="Zona horaria" value={profile?.zonaHoraria ?? "Europe/Madrid"} />
            <label>
              <span className="label mb-1 block">Preferencia visual</span>
              <select className="field" name="preferenciaVisual" defaultValue={profile?.preferenciaVisual ?? "sistema"}>
                <option value="sistema">Sistema</option>
                <option value="claro">Claro</option>
                <option value="oscuro">Oscuro futuro</option>
              </select>
            </label>
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
          <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <Checkbox name="notificacionesInternas" label="Notificaciones internas" checked={profile?.notificacionesInternas ?? true} />
            <Checkbox name="notificacionesEmail" label="Avisos por email cuando exista integración" checked={profile?.notificacionesEmail ?? false} />
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
            <Field name="municipio" label="Municipio" value={company?.municipio ?? ""} />
            <Field name="provincia" label="Provincia" value={company?.provincia ?? ""} />
            <Field name="pais" label="País" value={company?.pais ?? "España"} />
            <Field name="personaContacto" label="Persona contacto" value={company?.personaContacto ?? ""} />
            <Field name="iban" label="IBAN / datos bancarios" value={company?.iban ?? ""} />
            <Field name="colorMarca" label="Color marca" value={company?.colorMarca ?? "#f6c945"} type="color" />
            <Field name="ivaDefecto" label="IVA por defecto" value={company?.ivaDefecto ?? 21} type="number" />
            <Field name="moneda" label="Moneda" value={company?.moneda ?? "EUR"} />
            <Field name="validezPresupuestoDias" label="Validez presupuestos (días)" value={company?.validezPresupuestoDias ?? 15} type="number" />
            <Field name="formaPagoDefecto" label="Forma de pago por defecto" value={company?.formaPagoDefecto ?? ""} />
            <Field name="seriePresupuestos" label="Serie presupuestos" value={company?.seriePresupuestos ?? "2026"} />
            <Field name="serieFacturas" label="Serie facturas" value={company?.serieFacturas ?? "2026"} />
            <Field name="serieObras" label="Serie obras" value={company?.serieObras ?? "2026"} />
            <Field name="prefijoPresupuesto" label="Prefijo presupuesto" value={company?.prefijoPresupuesto ?? "P"} />
            <Field name="prefijoFactura" label="Prefijo factura" value={company?.prefijoFactura ?? "F"} />
            <Field name="prefijoObra" label="Prefijo obra" value={company?.prefijoObra ?? "OB"} />
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
          <h2 className="text-lg font-black text-obra-ink">Usar Orqena como app</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">iPhone</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Orqena en Safari.</li>
              <li>Pulsa compartir.</li>
              <li>Pulsa Añadir a pantalla de inicio.</li>
              <li>Abre Orqena desde el icono.</li>
            </ol>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="font-black text-obra-ink">Android</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Abre Orqena en Chrome.</li>
              <li>Pulsa el menú.</li>
              <li>Pulsa Instalar app o Añadir a pantalla de inicio.</li>
              <li>Abre Orqena desde el icono.</li>
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

      <section id="suscripcion" className="card scroll-mt-24 p-4">
        <h2 className="text-lg font-black text-obra-ink">Administración empresarial</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Cada área aplica permisos y capacidades comerciales en servidor. No se muestran precios sin aprobación comercial.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/equipo" className="secondary-button">Equipo y permisos</a><a href="/equipos" className="secondary-button">Equipos</a><a href="/plan-y-uso" className="secondary-button">Plan y uso</a><a href="/configuracion/memoria" className="secondary-button">Memoria de Orqena</a><a href="/auditoria" className="secondary-button">Auditoría</a><a href="#empresa" className="secondary-button">Zona sensible</a>
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

function Checkbox({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
      <input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4" />
      {label}
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
        <ImageIcon size={18} className="text-obra-yellowDark" aria-hidden="true" />
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
