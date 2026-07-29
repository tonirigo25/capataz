import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/commercial/authorization";
import { getBillingProvider } from "@/lib/commercial/billing";
import { planCatalog, type PlanKey } from "@/lib/commercial/plans";
import { assertLocalPlanSimulationAllowed as assertLocalPlanSimulation } from "@/lib/billing/guards";

export function assertLocalPlanSimulationAllowed(environment: Record<string, string | undefined> = process.env) {
  assertLocalPlanSimulation(environment);
}

export async function changeLocalPlan(formData: FormData) {
  assertLocalPlanSimulationAllowed();
  const auth = await requireCapability("company.billing.manage");
  const planKey = String(formData.get("planKey") ?? "") as PlanKey;
  if (
    auth.role !== "OWNER"
    || !(planKey in planCatalog)
    || String(formData.get("confirm")) !== "CAMBIAR"
  ) {
    throw new Error("PLAN_CHANGE_INVALID");
  }
  await getBillingProvider(prisma).changePlan({
    companyId: auth.companyId,
    planKey,
    actorId: auth.userId,
    reason: "Cambio confirmado en proveedor local",
  });
  revalidatePath("/plan-y-uso");
}
