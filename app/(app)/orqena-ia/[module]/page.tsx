import { notFound } from "next/navigation";
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
  return <OrqenaAiWorkspace area={area} />;
}
