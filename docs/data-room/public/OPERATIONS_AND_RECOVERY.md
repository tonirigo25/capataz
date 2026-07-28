# Operations and recovery

Deployment/runtime isolation is defined in `docs/architecture/CONFIGURATION.md`.
Rollback, backup, PITR and restore procedure is defined in
`docs/runbooks/BACKUP_RESTORE_AND_ENVIRONMENT_ISOLATION.md`; incidents use
`docs/runbooks/INCIDENT_RESPONSE.md`.

Local fresh-schema and repeat-deploy tests are reproducible. On 2026-07-26 an
authorized logical backup/restore ran against the isolated persistent review
database and a new sibling PostgreSQL service. The custom-format dump hash,
schema fingerprint, table/row counts, 43 migrations, tenant relationships,
upper-bound RTO and logical snapshot staleness are recorded in
`docs/readiness/evidence/c7/remote-restore-drill.json`. The source was not
replaced or repointed, and the temporary service and volume were removed after
validation.

This evidence is not a provider PITR claim and is not a representative
production-data migration rehearsal. Railway's native backup/PITR remains
`DR-RESTORE-001` / `READY_FOR_EXTERNAL_INPUT` because the observed Hobby plan
does not expose that capability. Production and staging were not touched.

The isolated review capacity and runtime-pool evidence is recorded in
`docs/readiness/evidence/c3/review-runtime-pool.json`. It distinguishes the
connection-exhaustion incident, the repaired standalone singleton, the
review-only connection limit and the public/authenticated synthetic load.
It makes no availability or production-capacity claim.
