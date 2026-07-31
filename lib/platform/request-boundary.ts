import { randomUUID } from "node:crypto";
import { log, safeErrorCode } from "@/lib/observability/logger";
import { resolveReleaseSha } from "@/lib/observability/release-sha";
import { normalizeTraceId, type RequestActor, type RequestContext, withRequestContext } from "@/lib/platform/request-context";

type RequestOperationInput = {
  operation: string;
  actor?: RequestActor;
  companyId?: string;
  membershipId?: string;
  provider?: string;
  jobId?: string;
};

type JobContextInput = RequestOperationInput & {
  correlationId?: string;
  causationId?: string;
  requestId?: string;
};

export function requestContextFromRequest(request: Request | undefined, input: RequestOperationInput): RequestContext {
  const requestId = normalizeTraceId(request?.headers.get("x-request-id"));
  return {
    requestId,
    correlationId: normalizeTraceId(request?.headers.get("x-correlation-id"), requestId),
    causationId: optionalTraceId(request?.headers.get("x-causation-id")),
    companyId: input.companyId,
    membershipId: input.membershipId,
    actor: input.actor ?? { type: "anonymous" },
    jobId: input.jobId ?? optionalTraceId(request?.headers.get("x-job-id")),
    provider: input.provider,
    operation: input.operation,
    release: resolveReleaseSha(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  };
}

export function publicRequestContext<T extends Response>(operation: string, request: Request | undefined, handler: () => Promise<T>): Promise<T> {
  return runRequestOperation(requestContextFromRequest(request, { operation }), handler);
}

export function internalRequestContext<T extends Response>(operation: string, request: Request | undefined, handler: () => Promise<T>): Promise<T> {
  return runRequestOperation(requestContextFromRequest(request, { operation, actor: { type: "system", id: operation } }), handler);
}

export function internalJobRequestContext<T extends Response>(operation: string, request: Request | undefined, handler: () => Promise<T>): Promise<T> {
  const jobId = optionalTraceId(request?.headers.get("x-job-id")) ?? randomUUID();
  return runRequestOperation(requestContextFromRequest(request, { operation, jobId, actor: { type: "system", id: operation } }), handler);
}

export function webhookRequestContext<T extends Response>(provider: string, operation: string, request: Request, handler: () => Promise<T>): Promise<T> {
  return runRequestOperation(requestContextFromRequest(request, { operation, provider, actor: { type: "provider", id: provider } }), handler);
}

export function withJobContext<T>(input: JobContextInput, handler: () => Promise<T>): Promise<T> {
  const requestId = normalizeTraceId(input.requestId);
  return runOperation({
    requestId,
    correlationId: normalizeTraceId(input.correlationId, requestId),
    causationId: input.causationId,
    companyId: input.companyId,
    membershipId: input.membershipId,
    actor: input.actor ?? { type: "system", id: input.operation },
    jobId: input.jobId ?? randomUUID(),
    provider: input.provider,
    operation: input.operation,
    release: resolveReleaseSha(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  }, handler);
}

export function withOutboxEventContext<T>(event: { id: string; companyId: string | null; actorId?: string | null; correlationId: string; causationId: string | null; destination: string | null }, operation: string, handler: () => Promise<T>): Promise<T> {
  return withJobContext({
    operation,
    requestId: event.id,
    correlationId: event.correlationId,
    causationId: event.causationId ?? event.id,
    companyId: event.companyId ?? undefined,
    actor: event.actorId ? { type: "user", id: event.actorId } : { type: "system", id: "outbox-worker" },
    jobId: event.id,
    provider: event.destination ?? undefined,
  }, handler);
}

async function runRequestOperation<T extends Response>(context: RequestContext, handler: () => Promise<T>): Promise<T> {
  const response = await runOperation(context, handler);
  response.headers.set("x-request-id", context.requestId);
  response.headers.set("x-correlation-id", context.correlationId);
  return response;
}

async function runOperation<T>(context: RequestContext, handler: () => Promise<T>): Promise<T> {
  return withRequestContext(context, async () => {
    const startedAt = Date.now();
    log("info", "operation_started");
    try {
      const result = await handler();
      log("info", "operation_completed", { durationMs: Date.now() - startedAt, status: "success" });
      return result;
    } catch (error) {
      log("error", "operation_failed", { durationMs: Date.now() - startedAt, status: "failed", errorCode: safeErrorCode(error) });
      throw error;
    }
  });
}

function optionalTraceId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeTraceId(value, "");
  return normalized || undefined;
}
