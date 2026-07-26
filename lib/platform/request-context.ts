import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

export type RequestActor = {
  type: "user" | "platform" | "system" | "provider" | "anonymous";
  id?: string;
};

export type RequestContext = {
  requestId: string;
  correlationId: string;
  causationId?: string;
  companyId?: string;
  actor: RequestActor;
  jobId?: string;
  membershipId?: string;
  provider?: string;
  operation?: string;
  release?: string;
  environment?: string;
};

const contextStorage = new AsyncLocalStorage<RequestContext>();
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function normalizeTraceId(value: string | null | undefined, fallback: string = randomUUID()): string {
  const normalized = value?.trim();
  return normalized && SAFE_ID.test(normalized) ? normalized : fallback;
}

export function withRequestContext<T>(context: RequestContext, operation: () => Promise<T>): Promise<T> {
  return contextStorage.run(context, operation);
}

export function getRequestContext(): RequestContext | undefined {
  return contextStorage.getStore();
}

export function enrichRequestContext(input: Partial<Omit<RequestContext, "requestId" | "correlationId">>): RequestContext {
  const context = contextStorage.getStore();
  if (!context) throw new Error("REQUEST_CONTEXT_REQUIRED");
  Object.assign(context, input);
  return context;
}

export async function requestContextFromHeaders(input: Partial<RequestContext> = {}): Promise<RequestContext> {
  const store = await headers();
  const requestId = input.requestId ?? normalizeTraceId(store.get("x-request-id"));
  return {
    requestId,
    correlationId: input.correlationId ?? normalizeTraceId(store.get("x-correlation-id"), requestId),
    causationId: input.causationId,
    companyId: input.companyId,
    actor: input.actor ?? { type: "anonymous" },
    jobId: input.jobId ?? normalizeOptionalId(store.get("x-job-id")),
    membershipId: input.membershipId,
    provider: input.provider,
    operation: input.operation,
    release: input.release ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RELEASE_SHA,
    environment: input.environment ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  };
}

function normalizeOptionalId(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && SAFE_ID.test(normalized) ? normalized : undefined;
}
