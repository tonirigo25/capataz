# Orqena production readiness execution log

## Program baseline

- Program branch: `program/orqena-production-readiness`
- Base ref: `origin/main`
- Base SHA: `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`
- Master input SHA-256: `584291DE898BD15FBC49DD15CD6F98061195F8AB4B6702323725AB9C7C98E8ED`
- Normalized tracked prompt SHA-256: `AB5BAD912067733EF514EE834C816B7AB5BB69BCCDF050370609E12CEEB892C2`
- Requirement ledger: 233 unique requirements in `docs/readiness/requirements.yaml`
- Production writes: forbidden during development unless separately authorized.

## F0 - Marketing V2 preview closure - PASS

Captured on 2026-07-25 in an isolated Railway environment created from staging and deleted after evidence capture.

- PR #24 remained `OPEN` and `DRAFT` on `feat/capataz-marketing-v2` at `ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4`.
- GitHub author was a human `User`; repository permission was `admin`.
- Preview environment: `capataz-review-pr-24` (`cb9f5ffe-6f86-4f45-ae70-e2f60a6f99a4`).
- Final preview web deployment: `6c991616-a5f9-46bd-b629-977caf960d7c`, `SUCCESS`, exact PR SHA.
- Preview Postgres deployment: `72d0ffc2-1784-4d55-9fc8-2cf29e8fd742`, `SUCCESS`.
- `DATABASE_URL` was an internal reference in the preview and contained no production reference.
- Database gate: 25 migrations found, zero pending.
- `/marketing-v2`, `/demo-v2`, `/`, `/demo`, `/login`, `/hoy`, and `/api/status` returned HTTP 200 after redirects where applicable.
- V2 routes retained `noindex, nofollow, noarchive, nosnippet`; sitemap had zero URLs and robots disallowed crawling.
- Browser gate passed at requested 390x844 and 1440x900 viewports: no horizontal overflow, broken images, console warnings/errors, valid-load network failures, or `/api/` calls from V2.
- Guided demo passed all six steps and the explicit simulated confirmation with zero network requests.
- Local gates passed: typecheck, production build, public-indexing suite, and `git diff --check`.
- Staging stayed on deployment `dc3ce593-3bc8-4abb-9167-9b9d2f774549`.
- Production stayed on deployment `2e266e66-be53-4008-a1b9-cbfaca21c750`, SHA `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`.
- Teardown passed: the preview environment, services, volume instances, and Railway domain were removed.
- Temporary resources were one web instance, one PostgreSQL instance, and two empty 5 GB volume instances; Railway CLI did not expose an exact accrued cost.
- No secret value was printed or committed.

Evidence: `docs/readiness/evidence/f0/audit-manifest.json` and the four hashed PNG captures in the same directory.

## F1 - Contract freeze - PASS

Completed on `feat/readiness-f1-contract` from program commit `9ad3bec5afb982af98d38fa343db989d1c7c40eb`. Production, staging, PR #24, and the Marketing V2 branch were not modified.

- The typed configuration contract centralizes environment, brand, public, server-only, URL, sender, and support values. The standalone entrypoint now fails closed for incomplete live gates without printing values.
- Fiscal, billing, live email, AI, analytics, and public indexing default off. Tenant overrides are represented by `FeatureFlag` and require an explicit company.
- The modular-monolith map defines eleven bounded contexts, dependency rules, web/worker boundaries, ownership, and repository fallback CODEOWNERS.
- Prisma contains 38 additive target tables and 32 nullable Decimal mirror columns. No legacy Float field was removed or converted.
- M01–M10 applied successfully on fresh isolated PostgreSQL: 35 total migrations, ten readiness migrations, 38 target tables, and a second deploy with no pending migrations.
- The money backfill passed dry-run and apply against one isolated tenant. Reconciliation covered 32 field pairs with aggregate absolute difference `0`.
- The generated Prisma documentation contains 130 models and 222 relations; its manifest SHA matches the schema. The SVG overview was rendered and visually reviewed.
- Contracts for events, prompts, templates, and artifacts are versioned under `contracts/*/v1`.
- `npm run readiness:validate-f1` passed 56 controls; Prisma validate/generate, TypeScript, runtime-config positive/negative checks, and the production build all passed. The build generated 63 static pages.
- A clean `npm ci` and production dependency audit passed with zero known vulnerabilities after raising Next.js to 15.5.22 and pinning safe transitive versions.
- All ten F1 requirements in the 233-item ledger are `PASS`; the remaining 223 retain their prior state.
- Pre-integration revalidation preserved head `dbabd19e6a891042a674b6c0d3756b3b4eb91510`: npm 11 clean install/audit, 35/35 migrations with an idempotent second deploy, 32-pair reconciliation, typecheck and 63-page build passed. The generated-schema hash false negative on Windows was proven to be CRLF-only; the LF-normalized hash matched the committed manifest.
- External `Prisma Compute Deploy` check-run `89728321459` from the Prisma app failed under npm 10 on the old lockfile. It was not required because the program branch had neither branch protection nor rulesets; it was documented without representing it as green, and the lockfile repair lives in F2.
- PR #25 was marked ready and integrated into the program branch with merge commit `6aedaa8a94a6a2a91a5ccfef95a71b576e331fce`; the phase SHA remains in history.

Evidence: `docs/readiness/evidence/f1/audit-manifest.json`, `generated-schema-diff.sql`, generated architecture artifacts, migrations, and executable validators.

## F2 - Platform core, security and observability - PASS

Implemented on `feat/readiness-f2-platform-core` from F1 commit `dbabd19e6a891042a674b6c0d3756b3b4eb91510`. Production and persistent staging were not modified; database/runtime checks used disposable loopback resources and one isolated temporary Railway environment that was deleted after validation.

- Added reusable PostgreSQL idempotency, persistent tenant-scoped rate limits, transactional BusinessEvent outbox with `SKIP LOCKED`, provider contracts/fakes, signed webhook verification/replay handling, and AES-256-GCM credential envelopes.
- Preserved opaque sessions and added transactional rotation for login replacement, company selection and support privilege elevation; password changes revoke all previous sessions.
- Added request/correlation headers, PII-safe structured logs, Node-only OpenTelemetry plus client bootstrap, per-request nonce CSP with report-only/enforce modes, full security headers, Origin/Host/CSRF validation, minimal public health and protected detailed status.
- Migrations 36 and 37 applied from fresh PostgreSQL. Concurrency exposed a Prisma-upsert race in the initial limiter; the final advisory-lock implementation passed exactly 5/8 same-tenant attempts while a second tenant passed 3/3 independently.
- The migration validator derives its expected total from the tracked migration directories; 37/37 applied and a second deploy reported no pending migrations.
- Generated schema hashing normalizes CRLF to LF, so the F1/F2 contract is reproducible across Windows and Linux checkouts.
- Isolated tests proved one idempotent execution, transactional outbox rollback and claim, webhook replay safety, encrypted credential round-trip, old-session revocation, protected health details and cross-site POST `403` with zero writes.
- Static F2 suite passed 26/26, auth regression passed, route access passed 52/52, OTLP exported one real span, TypeScript passed, and the production build generated 64 pages.
- Fake and production adapters for billing, email, storage, AI, fiscal and observability pass the identical six-provider contract suite with injected transports and zero external calls.
- All 30 action files and 129 exports use the canonical action boundary, with zero direct Prisma action access. Capataz is split into ten use-case/query modules; isolated PostgreSQL rejected cross-tenant access and rolled a forced failure back completely.
- All 30 action files, 16 route handlers and 2 internal job routes install canonical request/actor/tenant/job context. An action-to-provider probe preserved correlation through audit, transactional outbox, worker and replay-safe fake provider.
- Temporary Railway report-only and enforce deployments used exact commit `30fad8740557ebccdf982fd95b854a2b43ac90cd`. Twelve representative browser surfaces plus menu/theme/form/PDF interactions produced zero CSP findings and zero violation logs; HTTP header scans passed 12/12 and 11/11.
- The temporary environment, services and volume instances were removed. Attributable Railway cost was `$0.0035905805364022424`; an anonymous deleted volume makes the conservative upper bound `$0.00547945685476252`.
- Staging stayed on `dc3ce593-3bc8-4abb-9167-9b9d2f774549`; production stayed on `2e266e66-be53-4008-a1b9-cbfaca21c750`, both `SUCCESS`.
- Requirement ledger: all 19 F2 requirements are `PASS`; no F2 requirement remains pending, blocked, waived or waiting for external input.

Evidence: `docs/readiness/evidence/f2/audit-manifest.json`, `action-boundary-audit.md`, `context-correlation-audit.md`, `railway-security-validation.md`, the isolated validators, and migrations `20260725200000_readiness_f2_transactional_outbox` and `20260726100000_readiness_f2_observability_context`.

## F3 - Fiscal engine and electronic invoice - PASS WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f3-fiscal` from program commit `d5e1af3a26bac103e7ff403b7eec414c6c1da597`. Production, persistent staging and PR #24 were not modified; every database test used disposable loopback PostgreSQL and no external provider was called.

- Added a canonical Decimal invoice model, immutable fiscal snapshot, tenant/series transaction numbering, AEAT registration/cancellation hash chain, corrections, cancellation, QR payload, event ledger, outbox and release/configuration traceability.
- The three official AEAT 0.1.2 vectors matched exactly. QR parameter order, encoding, environment URL and legend match specification 0.5.0.
- A fresh isolated database applied 38/38 migrations. Eight concurrent issues produced exactly `F26-000001` through `F26-000008`; invalid input created neither sequence nor document.
- PostgreSQL triggers rejected fiscal-record mutation, fiscal-document deletion and artifact-content mutation. Ten records recomputed as one chain; a modified canonical input failed verification.
- Correction preserved its original. Cancellation appended evidence and retained the electronic artifact.
- Fake and HTTP fiscal adapters share one contract. A transient failure used two calls for one accepted effect; repeating the completed key was a local replay.
- UBL, CII, Facturae and EDIFACT adapters share one semantic hash and persist exact schema/validator/content versions. Local golden hashes are deterministic.
- Delivery adapters cover download, secure email, private exchange and the future public solution. Private replay produced one persisted delivery; the public solution failed closed.
- Acceptance, rejection and payment status form an append-only timeline. Isolated object restore reproduced exact bytes and the evidence manifest covered documents, records, events, artifacts, delivery and declaration.
- Legacy data is `LEGACY_NOT_RETRO_CERTIFIED`; it is not silently transmitted or represented as compliant.
- The declaration responsible generator emits a versioned technical draft explicitly requiring independent signature. Live issuance, live QR, transmission and public B2B stay off.
- Requirement ledger: 25 F3 requirements are `PASS`; `FISC-001`, `EINV-002`, `EINV-003`, `EINV-004` and `EINV-012` are `READY_FOR_EXTERNAL_INPUT`. No F3 requirement is pending, blocked or waived.

Evidence: `docs/readiness/evidence/f3/audit-manifest.json`, the two F3 validators, the fiscal/e-invoice contracts, compliance profiles, activation runbook, ADR 0007 and migration `20260726120000_readiness_f3_fiscal_einvoice_engine`.
