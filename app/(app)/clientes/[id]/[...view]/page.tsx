import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const canonicalViews = new Set([
  "obras",
  "oportunidades",
  "actividad",
  "presupuestos",
  "facturas",
  "conversaciones",
  "documentos",
  "archivos",
]);

export default async function ClientSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; view: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id, view }, query] = await Promise.all([params, searchParams]);
  if (view.length !== 1) notFound();
  const section = view[0];
  if (section === "editar") {
    redirect(`/gestion?tipo=cliente&id=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(`/clientes/${id}`)}`);
  }
  if (!canonicalViews.has(section)) notFound();

  const next = new URLSearchParams({ vista: section });
  for (const [key, value] of Object.entries(query)) {
    if (key === "vista" || value == null) continue;
    if (Array.isArray(value)) value.forEach((entry) => next.append(key, entry));
    else next.set(key, value);
  }
  redirect(`/clientes/${encodeURIComponent(id)}?${next.toString()}`);
}
