# F2 request, actor, tenant and job correlation audit

Date: 2026-07-26

## Boundary coverage

- Server Actions: **30/30 files**, **129/129 exports**, through `executeNextAction` and `withActionOperationContext`.
- Route handlers: **16/16** through `publicRequestContext`, `internalRequestContext`, or `internalJobRequestContext`.
- Scheduled/internal job routes: **2/2** with a generated or propagated job ID.
- Webhooks: canonical `webhookRequestContext` plus context-aware verified-webhook persistence.
- Outbox workers: canonical `withOutboxEventContext`, preserving correlation and assigning event causation/job identity.
- Platform operations: platform actor and temporary support tenant are bound after server-side authorization.

`scripts/readiness/validate-context-boundaries.mjs` enforces this inventory and checks the complete context contract. Its negative fixture proves that an unwrapped route is rejected.

## Context and privacy contract

The context includes request ID, correlation ID, causation ID, privacy-safe actor, company, membership, job, provider, operation, release, and environment. Structured logs emit only allow-listed fields; user and membership identifiers are SHA-256 truncated hashes. Payload, body, content, contact data, credentials, tokens, cookies, and authorization headers are filtered and never included by the wrappers.

Migration `20260726100000_readiness_f2_observability_context` adds only nullable columns and indexes to `AuditLog`, `SecurityAuditEvent`, `BusinessEvent`, and `WebhookEvent`. Audit writes through the canonical Prisma client inherit the active context. Security events, verified webhooks, direct business events, and transactional outbox events bind context explicitly.

## Isolated end-to-end proof

The isolated PostgreSQL suite executed:

```text
action boundary
  -> tenant-scoped correlation probe service
  -> AuditLog
  -> transactional BusinessEvent
  -> claim with SKIP LOCKED
  -> worker context
  -> idempotency guard
  -> fake observability provider
  -> final PROCESSED state
```

Observed assertions:

```text
migrations=37
correlationProbeTenantRejected=true
correlationSearchAuditRows=2
correlationProviderEffects=1
correlationReplayDetected=true
```

Both audit rows, the BusinessEvent, worker logs, and the provider receipt carried correlation `f2-action-service-worker-provider`. The worker used the BusinessEvent ID as request/job/causation identity. A replay returned the stored idempotent result and produced no second provider effect. A company-A action targeting company B failed before any audit/event write.

The database was a dynamic loopback `capataz_test_readiness_f2` instance and was deleted after the run. No staging or production data was read or changed.
