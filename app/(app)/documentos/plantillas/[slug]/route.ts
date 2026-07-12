import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { getTemplateAsset } from "@/lib/document-templates";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  await requireCompanyContext();
  const { slug } = await context.params;
  const asset = getTemplateAsset(slug);
  if (!asset) notFound();

  const filePath = path.join(process.cwd(), asset.relativePath);
  const bytes = await readFile(filePath);
  const preview = new URL(request.url).searchParams.get("preview") === "1" && asset.format === "pdf";

  return new Response(bytes, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${asset.fileName}"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
