import { notFound } from "next/navigation";
import {
  OrqenaAiWorkspace,
  orqenaAiAreas,
  type OrqenaAiArea,
} from "@/components/portal/modules-c/orqena-ai-workspace";

export const dynamic = "force-dynamic";

export default async function OrqenaAiModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!orqenaAiAreas.includes(module as (typeof orqenaAiAreas)[number])) notFound();
  return <OrqenaAiWorkspace area={module as OrqenaAiArea} />;
}
