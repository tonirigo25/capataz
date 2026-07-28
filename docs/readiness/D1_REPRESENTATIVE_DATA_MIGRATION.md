# D1 representative-data migration rehearsal

Status: `READY_FOR_EXTERNAL_INPUT`.

The 43 migrations have been applied successfully from an empty, isolated local
PostgreSQL database. That proves the empty-database path only. It does not prove
an upgrade over a representative production snapshot.

## Required input and authorization

- A formally authorized owner of the production data must approve the export.
- The supplied snapshot must be sanitized, encrypted in transit and stored in
  an approved temporary location outside Git.
- The snapshot must contain representative volumes and relationships, but no
  unnecessary personal data, secrets, provider credentials or live tokens.
- The rehearsal must run against a newly created, disposable database. It must
  never point to production or persistent staging.

## Executable rehearsal

1. Record the source schema version, row counts by table and a one-way checksum
   manifest. Do not put row contents in the evidence bundle.
2. Restore the sanitized snapshot into the disposable database.
3. Set `CAPATAZ_TEST_DATABASE_ISOLATED=true` and verify that `DATABASE_URL`
   resolves to localhost or to the explicitly approved temporary database.
4. Run `npm run db:deploy` once. A second migrator path is a release blocker.
5. Run the F2–F8 PostgreSQL validators and the golden-journey validator.
6. Compare row counts, tenant ownership, monetary totals and immutable audit
   chains before and after migration.
7. Measure migration duration, lock duration and recovery time.
8. Destroy the disposable database and encrypted snapshot according to the
   approved retention instruction.

## Evidence required to change status

The control can become `PASS` only when a signed evidence manifest names the
snapshot owner, authorizer, source schema SHA, candidate SHA, sanitized-data
attestation, database isolation proof, migration result, timings, invariants,
rollback result and destruction record. None of those external facts is
currently claimed.
