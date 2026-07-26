import { getRequestContext } from "@/lib/platform/request-context";

export function persistenceContext() {
  const context = getRequestContext();
  return {
    requestId: context?.requestId,
    correlationId: context?.correlationId,
    causationId: context?.causationId,
    membershipId: context?.membershipId,
    actorType: context?.actor.type,
    jobId: context?.jobId,
    provider: context?.provider,
    operation: context?.operation,
    release: context?.release,
    environment: context?.environment,
  };
}
