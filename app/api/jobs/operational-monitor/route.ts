import { prisma } from "@/lib/prisma";
import { authorizeInternalJob } from "@/lib/platform/job-auth";
import { internalJobRequestContext } from "@/lib/platform/request-boundary";
import { detectStaleHeartbeats, evaluateOperationalAlerts, recordJobHeartbeat } from "@/lib/observability/operations";

export async function POST(request: Request) {
  return internalJobRequestContext("POST /api/jobs/operational-monitor", request, async () => {
    if (!authorizeInternalJob(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
    const environment = process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "development";
    await recordJobHeartbeat(prisma, { jobKey: "operational-monitor", environment, outcome: "STARTED", expectedEverySeconds: 300 });
    const [stale, alerts] = await Promise.all([detectStaleHeartbeats(prisma, { environment }), evaluateOperationalAlerts(prisma, { environment, since: new Date(Date.now() - 15 * 60_000) })]);
    await recordJobHeartbeat(prisma, { jobKey: "operational-monitor", environment, outcome: "SUCCEEDED", expectedEverySeconds: 300 });
    return Response.json({ staleHeartbeats: stale.length, alerts: alerts.length });
  });
}
