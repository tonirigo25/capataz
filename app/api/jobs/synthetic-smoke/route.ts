import { prisma } from "@/lib/prisma";
import { authorizeInternalJob } from "@/lib/platform/job-auth";
import { internalJobRequestContext } from "@/lib/platform/request-boundary";
import { recordJobHeartbeat, runSyntheticSmoke } from "@/lib/observability/operations";

export async function POST(request: Request) {
  return internalJobRequestContext("POST /api/jobs/synthetic-smoke", request, async () => {
    if (!authorizeInternalJob(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
    const environment = process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "development";
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) return Response.json({ error: "base_url_not_configured" }, { status: 503 });
    await recordJobHeartbeat(prisma, { jobKey: "synthetic-smoke", environment, outcome: "STARTED", expectedEverySeconds: 900 });
    try {
      const result = await runSyntheticSmoke(prisma, { baseUrl, environment, release: process.env.RAILWAY_GIT_COMMIT_SHA });
      await recordJobHeartbeat(prisma, { jobKey: "synthetic-smoke", environment, outcome: "SUCCEEDED", expectedEverySeconds: 900 });
      return Response.json({ status: result.record.status, assertions: result.record.assertionCount });
    } catch (error) {
      await recordJobHeartbeat(prisma, { jobKey: "synthetic-smoke", environment, outcome: "FAILED", expectedEverySeconds: 900, metadata: { errorCode: error instanceof Error ? error.name : "unknown" } });
      return Response.json({ status: "FAIL" }, { status: 503 });
    }
  });
}
