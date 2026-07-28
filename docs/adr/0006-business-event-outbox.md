# ADR 0006: Promote BusinessEvent to the generic outbox

Status: accepted in F2 after F1 contract review.

The existing `BusinessEvent` already contains tenant, actor, correlation, causation, payload and schema-version fields. F2 promotes it to the shared transactional outbox by adding delivery state, attempts, scheduling, idempotency and terminal metadata. This avoids a duplicate event table and keeps existing readers compatible. The migration is additive; existing rows become already processed historical events and are never re-emitted.
