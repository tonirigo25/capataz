import { enforceExpiredBillingGrace } from "@/lib/billing/grace-job";
import { authorizeInternalJob } from "@/lib/platform/job-auth";
import { internalJobRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return internalJobRequestContext("POST /api/billing/jobs/grace-expiry", request, async () => {
    if (!authorizeInternalJob(request)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(await enforceExpiredBillingGrace());
  });
}
