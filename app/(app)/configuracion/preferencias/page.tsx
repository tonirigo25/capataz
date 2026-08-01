import Link from "next/link";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { savePreferences } from "./actions";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ExperiencePreferencesPage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const preference = await prisma.companyExperiencePreference.findUnique({ where: { companyId: actor.companyId } });
  return <main className="screen max-w-3xl">
    <InternalBreadcrumbs items={[{ label: "Configuración", href: "/configuracion" }, { label: "Privacidad y preferencias" }]} />
    <h1 className="type-page-title mt-2">Privacidad y preferencias</h1>
    <p className="type-secondary mt-2">Controla funciones opcionales. Los mensajes imprescindibles de seguridad, acceso o facturación no dependen de estas preferencias.</p>
    <form action={savePreferences} className="card mt-6 grid gap-4 p-5">
      <Preference name="aiSuggestionsEnabled" label="Sugerencias de IA" description="Permite sugerencias cuando la política de empresa y el interruptor global también estén activos. Activar esta casilla no habilita IA live por sí sola." checked={preference?.aiSuggestionsEnabled ?? false}/>
      <Preference name="operationalEmailEnabled" label="Resúmenes operativos por email" description="Avisos no esenciales sobre actividad y seguimiento. Las notificaciones internas siguen disponibles." checked={preference?.operationalEmailEnabled ?? true}/>
      <Preference name="marketingEmailEnabled" label="Novedades y comunicaciones comerciales" description="Desactivado por defecto y separado de mensajes transaccionales." checked={preference?.marketingEmailEnabled ?? false}/>
      <button className="primary-button">Guardar preferencias</button>
    </form>
    <div className="mt-4 flex flex-wrap gap-2"><Link className="secondary-button" href="/configuracion/privacidad">Gestionar derechos y privacidad</Link><Link className="secondary-button" href="/configuracion/ia">Ver uso y revisión de IA</Link></div>
  </main>;
}

function Preference({ name, label, description, checked }: { name: string; label: string; description: string; checked: boolean }) {
  return <label className="flex items-start gap-3 rounded-lg border border-border p-4"><input type="checkbox" name={name} defaultChecked={checked} className="mt-1"/><span><strong>{label}</strong><span className="type-secondary mt-1 block">{description}</span></span></label>;
}
