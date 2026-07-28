import { RestrictedState } from "@/components/ui-primitives";
import { requireCompanyContext } from "@/lib/auth/session";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

const messages = { permission: "No tienes acceso a esta sección.", entitlement: "Tu portal no incluye esta capacidad con el plan actual.", membership: "Tu acceso empresarial no está activo.", company: "La empresa está suspendida temporalmente.", subscription: "El estado comercial actual limita esta acción." };
export default async function RestrictedPage({ searchParams }: { searchParams: Promise<{ reason?: keyof typeof messages }> }) {
  const { reason = "permission" } = await searchParams;
  const manifest = await buildPortalManifest(await requireCompanyContext());
  return (
    <main className="screen mx-auto max-w-2xl">
      <RestrictedState
        title="No tienes acceso a esta sección"
        description={messages[reason] ?? messages.permission}
        returnHref={manifest.safeHome}
        secondaryAction={reason === "permission" ? <a href="mailto:propietario@orqena.invalid" className="secondary-button">Solicitar revisión</a> : null}
      />
    </main>
  );
}
