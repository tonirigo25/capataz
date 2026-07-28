# Versioned contracts

Persisted events, AI prompts, rendered templates, and generated artifacts must identify a version. Published versions are immutable; breaking changes create a new version directory and an explicit compatibility adapter.

Every tenant-owned envelope includes `companyId`, `schemaVersion`, `occurredAt`, correlation and idempotency identifiers. Payloads must not contain plaintext secrets.
