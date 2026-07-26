import { getPrivateStorageService } from "@/lib/private-storage";
import { publicRequestContext } from "@/lib/platform/request-boundary";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return publicRequestContext("GET /api/storage/[id]", request, async () => {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("grant") ?? "";
  const storage = getPrivateStorageService();
  const claims = storage.verifySignedGrant(token, { expectedObjectId: id });
  const result = await storage.readVerified({ companyId: claims.companyId, objectId: claims.objectId });
  return new Response(result.bytes.slice().buffer as ArrayBuffer, { headers: { "content-type": result.object.mimeType, "content-disposition": result.object.contentDisposition ?? "attachment", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}
