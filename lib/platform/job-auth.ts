import { timingSafeEqual } from "node:crypto";

export function authorizeInternalJob(request: Request) {
  const expected = process.env.JOB_RUNNER_SECRET ?? "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return Boolean(expected && left.length === right.length && timingSafeEqual(left, right));
}
