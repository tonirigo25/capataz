import { notFound } from "next/navigation";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import {
  OrqenaAiWorkspace,
  orqenaAiAreas,
} from "@/components/portal/modules-c/orqena-ai-workspace";

export const dynamic = "force-dynamic";

export default async function OrqenaAiModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!orqenaAiAreas.includes(module as (typeof orqenaAiAreas)[number])) notFound();
  const area = module as (typeof orqenaAiAreas)[number];
  const label = ({ comercial: "Comercial", operaciones: "Operaciones", documentos: "Documentos", finanzas: "Finanzas", equipo: "Equipo" } as const)[area];
  return <>
    <div className="mx-auto -mb-6 w-full px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8" style={{ maxWidth: "var(--cap-content-max)" }}>
      <InternalBreadcrumbs items={[{ label: "Orqena IA", href: "/orqena-ia" }, { label }]} />
    </div>
    <OrqenaAiWorkspace area={area} />
  </>;
}
