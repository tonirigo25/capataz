# Additive migration and backfill strategy

## Safety contract

- M01–M10 only add tables, indexes, foreign keys, nullable mirror columns, or metadata columns.
- No migration renames, drops, truncates, rewrites, or converts an existing money column.
- Every application migration uses short lock and statement timeouts.
- Backfills require `--dry-run`, an explicit `--company-id`, bounded `--batch-size`, and resumable `--resume-from`.
- An apply run is refused outside an isolated local `capataz_test*` database unless a separately authorized approval gate is present.
- Reconciliation reports counts and aggregate differences; it never silently corrects source data.

## Train

| Migration | Scope | Forward compatibility | Operational rollback |
| --- | --- | --- | --- |
| M01 platform contracts | flags, idempotency, webhooks, integrations, encrypted credentials | unused tables; all flags off | stop writers; drop only while empty |
| M02 fiscal ledger | fiscal documents, append-only records, transmissions, events, declarations | fiscal flag off | stop fiscal worker; preserve ledger for audit |
| M03 electronic invoicing | artifacts, delivery, status events | electronic delivery off | stop delivery worker; retain artifacts |
| M04 billing webhooks | customer, price mapping, billing events, subscription metadata | billing flag off | disable Stripe ingress; restore prior projection from event log |
| M05 email delivery | suppression/webhook tables and outbox metadata | live email off | switch provider to local; retain delivery evidence |
| M06 privacy governance | legal, processing, retention, rights and breach records | no automated retention | disable jobs; never delete governance evidence |
| M07 AI governance | policy, versions, usage and evaluations | AI flag off | disable provider calls; retain usage audit |
| M08 product analytics/support | events, metrics, pilots, tickets, incidents | analytics flag off | disable ingestion; retain support records |
| M09 storage integrity | object and scan records, document link | local legacy path still readable | disable new uploads; keep both references |
| M10 Decimal transition | nullable Decimal mirrors only | reads remain on existing Float fields | stop backfill; nullable mirrors may remain |

## Decimal cutover

1. Deploy nullable mirrors without changing reads or writes.
2. Dry-run per company and capture row counts plus source aggregates.
3. Backfill in short transactions using deterministic decimal text conversion.
4. Dual-write and reconcile until every critical aggregate difference is exactly `0.00`.
5. Move fiscal reads to Decimal only after independent evidence.
6. Remove legacy Float fields only in a future, separately approved migration after rollback windows expire.

## Preflight and recovery

Before each environment: exact release SHA, database identity/classification, backup/PITR evidence, migration history, lock inspection, row-count estimate, and a tested restore command. On failure, stop writers/workers, preserve the failed migration and logs, restore service with the previous SHA, and choose roll-forward or database restore based on whether business data was committed. Never mark a failed migration as applied without reconciling the physical schema.
