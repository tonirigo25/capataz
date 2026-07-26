import { prisma } from "@/lib/prisma";
import { purgeExpiredAiContent } from "@/lib/ai/governance-service";
import { authorizeInternalJob } from "@/lib/platform/job-auth";
import { internalJobRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return internalJobRequestContext("POST /api/jobs/ai-retention", request, async () => {
    if (!authorizeInternalJob(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json(await purgeExpiredAiContent(prisma));
  });
}
