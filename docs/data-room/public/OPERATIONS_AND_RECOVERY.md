# Operations and recovery

Deployment/runtime isolation is defined in `docs/architecture/CONFIGURATION.md`.
Rollback, backup, PITR and restore procedure is defined in
`docs/runbooks/BACKUP_RESTORE_AND_ENVIRONMENT_ISOLATION.md`; incidents use
`docs/runbooks/INCIDENT_RESPONSE.md`.

Local fresh-schema, repeat-deploy and new-target reference restore tests are
reproducible. A real provider backup/PITR activation and sibling-service restore
remain `DR-RESTORE-001` because they mutate infrastructure. No remote RPO/RTO is
inferred from local results.
