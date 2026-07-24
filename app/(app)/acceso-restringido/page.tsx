import Link from "next/link";
import { requireCompanyContext } from "@/lib/auth/session";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

const messages = { permission: "No tienes acceso a esta sección.", entitlement: "Tu portal no incluye esta capacidad con el plan actual.", membership: "Tu acceso empresarial no está activo.", company: "La empresa está suspendida temporalmente.", subscription: "El estado comercial actual limita esta acción." };
export default async function RestrictedPage({ searchParams }: { searchParams: Promise<{ reason?: keyof typeof messages }> }) {
  const { reason = "permission" } = await searchParams;
  const manifest = await buildPortalManifest(await requireCompanyContext());
  return <main className="screen mx-auto max-w-2xl"><div className="card p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-xl" aria-hidden="true">🔒</div><p className="type-label mt-4">Acceso restringido</p><h1 className="type-page-title mt-2">No tienes acceso a esta sección</h1><p className="type-secondary mt-3">{messages[reason] ?? messages.permission}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link href={manifest.safeHome} className="primary-button">Volver a mi portal</Link>{reason === "permission" ? <a href="mailto:propietario@orqena.invalid" className="secondary-button">Solicitar revisión</a> : null}</div></div></main>;
}
