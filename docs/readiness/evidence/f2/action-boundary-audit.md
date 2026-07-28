# F2 action boundary audit

Date: 2026-07-26

## Result

ARCH-007 is enforced across all 32 Server Action files and all 140 exported actions after the F5 additions.

- Direct Prisma imports or references in `app/**/actions.ts`: **0**.
- Exported actions classified by input, authentication, authorization, query/command mode, application service, and post-effects: **140/140**.
- Server Action files using the canonical `executeNextAction` boundary: **32/32**.
- Application services importing `next/cache` or `next/navigation`: **0**.
- Unsafe direct-Prisma negative fixture: **rejected**.
- Capataz application surface: split into ten use-case/query modules; largest module is 1,026 lines and the validator rejects modules over 1,200 lines.

The machine-readable inventory is `docs/readiness/evidence/f2/action-boundary-classification.json`. `scripts/readiness/validate-action-boundaries.mjs` compares that inventory with the TypeScript AST on every run, rejects stale or missing exports, rejects direct Prisma/transactional logic in action files, requires migrated actions to remain one-statement adapters, prohibits Next UI primitives in application services, and enforces the Capataz module-size ceiling. `scripts/readiness/validate-action-boundaries-negative.mjs` proves the rule with `scripts/readiness/fixtures/action-boundary-direct-prisma.fixture.ts`.

## Boundary contract

`executeNextAction` installs request, correlation, release, environment, operation, and privacy-safe actor context. Authenticated application actions resolve the active company and membership before invoking the use case. Application use cases own input parsing and capability/scope checks; transaction-bearing business operations live behind tenant-scoped services. UI invalidation/navigation is exposed through an injected action-effects port, so application services do not import Next cache or navigation primitives.

The extracted team service is the executable transactional reference:

- a company-A context cannot assign a company-B membership;
- the rejected attempt creates no `TeamMembership`;
- a forced audit collision after team creation rolls the complete transaction back;
- the isolated PostgreSQL result records `actionServiceCrossTenantRejected: true` and `actionServiceTransactionRollback: true`.

## Validation evidence

```text
classified=140
action boundaries: PASS
action boundary negative fixture: PASS
direct_action_files=0
unwrapped_action_files=0
actionServiceCrossTenantRejected=true
actionServiceTransactionRollback=true
```

The PostgreSQL proof ran only against a dynamic loopback `capataz_test_readiness_f2` database and cleaned its runtime. No staging or production database was used.
