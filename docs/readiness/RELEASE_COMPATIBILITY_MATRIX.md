# D2 release compatibility matrix

Status: `IN_PROGRESS` until the automated contract and browser/PWA checks pass
on the exact candidate SHA.

| Surface | Old state accepted during rollout | New state | Rollback expectation |
| --- | --- | --- | --- |
| Environment flags | Missing flags resolve to disabled | Explicit allowlisted flags | Set changed flag to `false`; no data rewrite |
| Public registration | Invitations only | Invitations only during private beta | Autonomous signup stays closed |
| Brand aliases | `/capataz`, `CAPATAZ_*` and old internal filenames | Visible product name Orqena | Keep aliases until a separately approved deprecation |
| PWA client | Previously cached shell may coexist during deploy | New shell and service worker | Old shell must recover without destructive cache/data action |
| Android client | Existing unpublished Capataz package is not a public compatibility promise | `com.orqena.app` release candidate | No store rollout before device and signing evidence |
| Deep links | Existing HTTPS paths | Same route paths under a controlled future domain | No domain association until domain ownership exists |
| Database | 43-migration source schema | Same 43 migrations in this candidate | Forward-only schema; application rollback must tolerate it |

The machine-readable flag contract is
`contracts/release/v1/feature-flags.json`. Every flag includes an owner,
environment default, activation evidence, kill switch and rollback instruction.

## Canary and rollback

The release rehearsal must start with a temporary preview, then an explicitly
approved canary. It must verify health, migrations, 5xx, authorization and
golden journeys before expanding traffic. A rollback restores the previous
application SHA without reversing migrations, then disables optional providers
and re-runs health/tenant checks. Production canary and rollback execution need
external authorization and remain `READY_FOR_EXTERNAL_INPUT`.
