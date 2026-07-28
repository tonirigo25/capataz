import { getPrivateStorageService } from "@/lib/private-storage";
import { prisma } from "@/lib/prisma";

export async function loadCompanyPdfLogo(companyId: string, objectId: string | null | undefined) {
  if (!objectId) return null;
  try {
    const result = await getPrivateStorageService(prisma).readVerified({ companyId, objectId });
    if (result.object.mimeType !== "image/jpeg") return null;
    return { bytes: result.bytes, mimeType: "image/jpeg" as const };
  } catch {
    return null;
  }
}
