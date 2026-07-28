import { timingSafeEqual } from "node:crypto";
import { claimEmailBatch, processClaimedEmail } from "@/lib/email/outbox";
import { getEmailDeliveryProvider } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { internalJobRequestContext } from "@/lib/platform/request-boundary";

export async function POST(request: Request) {
  return internalJobRequestContext("POST /api/jobs/email-outbox", request, async () => {
  const expected = process.env.JOB_RUNNER_SECRET ?? "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(expected); const right = Buffer.from(provided);
  if (!expected || left.length !== right.length || !timingSafeEqual(left, right)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const claimed = await claimEmailBatch(prisma, { batchSize: 50 });
  const provider = getEmailDeliveryProvider();
  const results = [];
  for (const item of claimed) results.push(await processClaimedEmail(prisma, item, provider));
  return Response.json({ claimed: claimed.length, sent: results.filter((item) => item.status === "SENT").length, retrying: results.filter((item) => item.status === "RETRYING").length, failed: results.filter((item) => item.status === "FAILED").length });
  });
}
