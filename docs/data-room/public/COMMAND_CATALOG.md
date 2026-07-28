# Reproducible command catalog

Prerequisites: Node 22.18, locked npm dependencies, Git and the documented
isolated PostgreSQL runtime for database suites.

| Gate | Command |
| --- | --- |
| Install | `npm ci --ignore-scripts` then `npx prisma generate` |
| Static governance | `npm run readiness:validate-f11` |
| Unit | `npm run test:unit` |
| Browser | `npm run build` then `npm run test:e2e` |
| Tenant pentest | `npm run readiness:validate-f11-tenant` |
| Type/build | `npm run typecheck` and `npm run build` |
| Dependencies/secrets | `npx audit-ci --high` and `npm run readiness:scan-secrets` |
| SBOM/licenses | `npm run security:sbom` and `npm run readiness:licenses` |
| Readiness report | `npm run readiness:report` |
| Release manifest | `npm run readiness:release-manifest -- --sha <full SHA>` |

Database commands must satisfy `CAPATAZ_TEST_DATABASE_ISOLATED=true`, loopback
host and a `capataz_test*` database name. Provider flags remain off.
