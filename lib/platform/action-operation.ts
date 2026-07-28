import { log, safeErrorCode } from "@/lib/observability/logger";
import { type RequestContext, withRequestContext } from "@/lib/platform/request-context";

export async function withActionOperationContext<T>(context: RequestContext, operation: () => Promise<T>): Promise<T> {
  return withRequestContext(context, async () => {
    const startedAt = Date.now();
    log("info", "action_started");
    try {
      const result = await operation();
      log("info", "action_completed", { durationMs: Date.now() - startedAt, status: "success" });
      return result;
    } catch (error) {
      const navigation = isNextControlFlow(error);
      log(navigation ? "info" : "error", navigation ? "action_navigation" : "action_failed", {
        durationMs: Date.now() - startedAt,
        status: navigation ? "navigation" : "failed",
        errorCode: safeErrorCode(error),
      });
      throw error;
    }
  });
}

function isNextControlFlow(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK)/u.test(error.digest));
}
