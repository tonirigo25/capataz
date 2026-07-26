# Architecture, data and critical flows

Orqena is a Next.js modular monolith with server-owned sessions, PostgreSQL as the
system of record, Prisma migrations, transactional outboxes and injected provider
boundaries. The mobile applications are Capacitor clients of the same backend.

The generated [ERD](../../architecture/generated/ERD.svg), [data dictionary](../../architecture/generated/DATA_DICTIONARY.md), [domain map](../../architecture/DOMAIN_MAP.md) and schema manifest are authoritative orientation artifacts.

Critical flow invariants:

1. Authentication resolves actor and active company on the server.
2. Authorization and company scope are checked before reads or writes.
3. Mutations use idempotency and transactions; external effects enter an outbox.
4. Sensitive effects require explicit human confirmation.
5. Provider adapters apply feature flags, budgets, minimization and safe failure.
6. Audit/correlation evidence records identity references and hashes, not content.
