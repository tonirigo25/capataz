"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/commercial/authorization";
import { archiveMemory, confirmMemory, rejectMemory } from "@/lib/orqena/memory-service";
export async function changeMemory(formData: FormData) { const auth = await requireCapability("orqena.memory.manage"); const id = String(formData.get("id") ?? ""); const action = String(formData.get("action") ?? ""); if (!id) return; if (action === "confirm") await confirmMemory(auth.companyId, id, auth.userId); else if (action === "reject") await rejectMemory(auth.companyId, id, auth.userId); else if (action === "archive") await archiveMemory(auth.companyId, id, auth.userId); revalidatePath("/configuracion/memoria"); }
