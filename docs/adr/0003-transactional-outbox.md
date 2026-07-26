# ADR 0003: Transactional outbox and idempotency

Status: accepted.

External side effects are recorded in the same database transaction as the business decision, then delivered asynchronously. Each request and webhook has a stable idempotency key, persisted schema version, bounded retries, and auditable terminal state.
