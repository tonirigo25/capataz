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

## F4 - Commercial, email and private storage - PASS WITH EXTERNAL INPUT GATE

Implemented on `feat/readiness-f4-commercial` from program commit `f8be0e682236b25f5f208d259911c30e98dac862`. Production, persistent staging and PR #24 were not modified; validation used disposable loopback PostgreSQL and injected provider doubles.

- Stripe checkout and customer portal require authenticated OWNER context, HTTPS return URLs, database price mappings and tenant idempotency. Raw-body signed webhooks deduplicate events, reject cross-tenant metadata and ignore stale projections.
- All six subscription statuses passed. Failed payment creates one email plus one task, applies a seven-day grace period and later read-only access; paid clears the grace. Overuse for members, documents and AI failed closed with no automatic charge.
- Reconciliation stores divergence in audit-only mode. Cancellation reason/cohort metrics and subscription-specific fiscal identity are separate from operational customer invoices.
- Auth, invitation, billing, support and alert email use one transactional outbox. Two concurrent claimers had no overlapping IDs. Templates enforce variables before provider calls; retry, dead letter, admin replay, suppression and signed Resend replay passed.
- Verification/reset/invitation action tokens are rendered in memory from an HMAC derivation secret. No plaintext token, action URL or rendered body persisted in outbox, attempts or audit.
- Company logo/seal URLs were removed from editable settings and PDF inputs. Private uploads store safe name, MIME, size, hash, provider/version and tenant key; signed short grants reject expiry and cross-tenant access, and modified bytes fail integrity verification.
- Fresh isolated PostgreSQL applied 39/39 migrations. The F4 pure suite passed 11/11 and the isolated integration suite passed through billing, usage, email/webhooks and storage.
- Architectural regression classifies all 132 Server Action exports and preserves canonical context across 30 action files, 20 routes and 3 internal jobs; positive and negative fixtures passed. Auth PostgreSQL regression also passed.
- Requirement ledger: 31 F4 requirements are `PASS`; EMAIL-010 is `READY_FOR_EXTERNAL_INPUT` for owner-approved DNS/domain/provider values. No F4 requirement remains pending, blocked or waived.

Evidence: `docs/readiness/evidence/f4/audit-manifest.json`, F4 validators, ADR 0008, operational/domain runbooks and migration `20260726140000_readiness_f4_commercial_email_storage`.

## F5 - Privacy, security and operational resilience - PASS WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f5-continuity` from program commit `097021d594700454ac2e7da0d991f071d5549372`. Production, persistent staging and PR #24 were not modified; database validation used disposable loopback PostgreSQL, provider behavior used injected local doubles, and no external message or provider request was sent.

- PLATFORM_OWNER and PLATFORM_ADMIN operations now require an active TOTP factor and a fresh second-factor session challenge. Secrets use AES-GCM keyring encryption; session rotation preserves the verified factor only through the authorized flow.
- Sensitive audit events form a tenant-scoped SHA-256 chain under a PostgreSQL transaction lock. The isolated negative test modified a prior row and the verifier detected the broken chain.
- Support access retains minimum privilege, expiration, explicit closure, session rotation and chained read/start/end audit evidence.
- Uploads enter `QUARANTINED`; real signature/MIME/size/hash checks and an injected malware scanner decide whether an object becomes `READY`, remains quarantined or becomes `BLOCKED`. The EICAR fixture never became readable.
- Privacy governance now covers a maintainable RAT, versioned legal-document hashes, consent history, rights requests and calendar-month deadlines, safe erasure with legal hold, retention dry-run/apply, breach records, risk/DPIA records, data classification and subprocessor-change records.
- Company export walks tenant-scoped records, removes provider/secret references, includes verified storage bytes plus model/object hashes, detects tampering and produces deterministic remapped references for a new restore target. Subject export is intentionally minimized and excludes company object payloads.
- Operational monitoring persists metrics, thresholds, worker heartbeats, dead letters, synthetic results, incidents, timelines and postmortem actions. Error tracking is optional, environment-scoped and allow-list redacted.
- A fresh isolated database applied 40/40 migrations. The pure F5 suite passed 18/18 and the isolated PostgreSQL suite passed 12/12, including tenant-negative PDF/export/search/chat/job/billing/storage probes and zero external calls.
- Architectural regression classifies all 140 Server Action exports and preserves canonical context across 32 action files, 22 routes and 5 internal jobs.
- Requirement ledger: 29 F5 requirements are `PASS`; `SEC-018`, `PRIV-003`, `PRIV-012`, `STOR-007`, `STOR-008`, `STOR-009`, `OBS-009` and `OBS-010` are `READY_FOR_EXTERNAL_INPUT`. These require current environment/resource evidence, authorized provider/legal input, or a real isolated restore/scheduler observation; none is represented as activated or approved.
- No F5 requirement is pending, blocked or waived.

Evidence: `docs/readiness/evidence/f5/audit-manifest.json`, the F5 validators, privacy/legal/observability contracts, runbooks and migration `20260726160000_readiness_f5_privacy_security`.

## F6 - Governed AI gateway - PASS NON-LIVE WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f6-ai` from program commit `7a58a7a213dff4e2ca74824aee0a421c874d8fca`. Production and persistent staging were not modified. No OpenAI key was created or written, no secret was exposed, and no real provider call was made.

- The secure Platform/local-save UI returned `not_approved` in three attempts. `OPENAI-KEY-SETUP-UI` and `AI-LIVE-001` through `AI-LIVE-006` are recorded as `READY_FOR_EXTERNAL_INPUT`; the flow was not repeated or replaced with a manual method.
- Added one governed server gateway and one OpenAI endpoint owner. The browser CSP no longer permits direct OpenAI connections. Contracts version request/response, model lanes, synthetic pricing and the evaluation dataset.
- Company policy fails closed by global flag, company enable/kill switch, purpose, role, scope, field allowlist and classification. Company/user/month/operation budgets plus token, byte, time and concurrency limits block before transport.
- Context minimization and deterministic redaction removed synthetic email, NIF, IBAN, phone, address and key-shaped content. A different company ID and exfiltration request failed before transport. Provider metadata uses pseudonymous references.
- Strict schema validation, `store=false`, AbortController timeouts, retryable-status allowlist, bounded exponential backoff/jitter, circuit breaker and deterministic manual fallback passed with injected transports.
- Idempotency persisted one effect and replayed the stored envelope without a second provider call. Sensitive actions required exact human confirmation and then entered a sanitized transactional outbox; model output never executed the effect.
- Usage evidence stores hashes, model/snapshot, purpose, prompt/schema version, correlation IDs, tokens, synthetic estimated cost, latency, errors/retries and review outcome without prompts or output content. The OWNER/ADMIN panel exposes aggregate usage and accepted/corrected/rejected reviews.
- The retention job purged expired response envelopes and kept request/output/evidence hashes. The compliance template and runbook cover minimum permissions, budgets/alerts, local/staging/production activation, rotation and emergency revocation without claiming provider settings as active.
- Pure fake suite passed 44/44, static safety suite 36/36 and isolated PostgreSQL suite 8/8 after 41/41 fresh migrations. Typecheck and a 73-page production build passed. F1-F5 regressions passed, provider contracts used zero external calls, dependency audit reported zero known vulnerabilities, and the secret scan covered 835 files with zero findings.
- Requirement ledger: 15 F6 requirements are `PASS`; `AI-004`, `AI-006` and `AI-016` are `READY_FOR_EXTERNAL_INPUT`. No F6 requirement is pending, blocked or waived. F6 is not represented as a total live PASS.

Evidence: `docs/readiness/evidence/f6/audit-manifest.json`, `synthetic-usage-summary.json`, `openai-key-setup-ui.md`, F6 validators, AI contracts, runbook and migration `20260726180000_readiness_f6_ai_governance`.

## F7 - Product integration - PASS

Implemented on `feat/readiness-f7-product-integration` from program commit `70fcff07ee45d61f020367db3a3cdaa5fc9e2756`. Production, persistent staging, PR #24 and the OpenAI key workflow were not modified; validation used only local code, synthetic fixtures and disposable loopback PostgreSQL.

- Guided onboarding now permits OWNER/ADMIN completion by organization, trade, objective and first action. `/hoy` shows a company/client/budget/document activation checklist and writes only pseudonymous, idempotent milestone events classified against a seven-day window.
- Safe CSV import supports clients and document metadata with strict headers, 500-row/512-KB limits, row-level validation, formula-injection rejection, tenant deduplication, preview, exact apply confirmation, advisory locking and rollback restricted to batch-created entities.
- Plan/usage reads real membership, document, storage, AI and usage aggregates. Stripe checkout/portal remain owner-confirmed and price-mapped; local simulation cannot render in production and incomplete live billing remains fail-closed.
- The existing privacy-rights center is joined by versioned AI and email preferences. AI opt-out enables the company kill switch; preference opt-in cannot activate or clear live AI gates.
- Authenticated support stores a sanitized route without query parameters, release and correlation references, pseudonymous actor and minimal context. Key-shaped text, email, phone and tax identifiers are redacted; optional images pass private-storage checks.
- PDFs use a versioned rendering contract, preserve Spanish WinAnsi characters and euro, support a verified tenant-scoped JPEG logo with deterministic fallback, emit template/hash headers without PII and pass deterministic multipage golden tests.
- Manual client, budget, document and money workflows remain available with AI/integrations off. All 147 action exports are classified and no UI action writes through Prisma directly.
- Fresh isolated PostgreSQL applied 42/42 migrations and passed 8/8 two-tenant cases. The pure suite passed 43/43, PDF golden passed, action/context positive and negative suites passed, typecheck passed and the production build generated 73 static pages.
- F1–F6 regressions passed; provider contracts made zero external calls, dependency audit reported zero known vulnerabilities and the secret scan covered 855 files with zero findings.
- Requirement ledger: all nine F7 requirements are `PASS`; no F7 requirement is pending, blocked, waived or waiting for external input.

Evidence: `docs/readiness/evidence/f7/audit-manifest.json`, the F7 validators, document rendering contract and migration `20260726190000_readiness_f7_product_integration`.

## F8 - Product metrics, pilots, support and accessibility - PASS WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f8-metrics-pilots` from program commit `6cab476d112f518ac919bf03734445f08389bd94`. Production, persistent staging, Marketing V2 and the OpenAI key workflow were not modified. Validation used synthetic fixtures, disposable loopback PostgreSQL and a temporary standalone server bound to `127.0.0.1`.

- Added a versioned, first-party event contract with strict event/property allowlists, value bounds, sensitive-value rejection, pseudonymous actors and idempotent event IDs. `ANALYTICS_ENABLED=false` remains the default and gates both browser reporting and ingestion.
- Added an aggregate `f8-v1` health snapshot for activation in seven days, WAU users/companies, M1/M2/M3 retention, reconciled MRR/ARPA, verified cost-to-serve, gross margin, budget conversion, collection time, recovered debt, time saved, AI outcomes, support, pilots and experiments.
- MRR accepts only the latest Stripe reconciliation in `MATCHED` state with zero divergences; local simulations and diverged snapshots contribute zero. Costs require a hashed source reference and explicit verification; unverified values contribute zero.
- Added PLATFORM_OWNER governance for pilot cohorts, service costs and product experiments, plus PLATFORM_SUPPORT ticket operations. The aggregate dashboard does not select ticket subject/description/context or tenant content.
- Pilot records cover payment, contract, consent, objectives, measurable criteria, cadence, onboarding timestamps, result, outcome and a minimized commercial-support-product handoff. Actual enrollment remains external and fixtures are never counted as real pilots.
- Authenticated support now includes a safe knowledge base, internal SLA deadlines, time/resolution accounting, optional consented NPS/CSAT and separately authorized contact. Testimonial permissions are scoped and revocable.
- Versioned Web Vitals budgets and the local browser gate covered `/`, `/login`, `/producto`, `/planes`, authenticated `/hoy` and authenticated support against fresh isolated PostgreSQL: all returned 200, axe reported zero critical/serious findings, keyboard focus and reduced motion passed, and measured local LCP/CLS/INP/FCP/TTFB stayed within budget. These are loopback measurements, not staging/production latency.
- Fresh isolated PostgreSQL applied 43/43 migrations and F8 passed 10/10 two-tenant integration blocks. The pure suite passed 55/55; action/context boundaries passed for 153 exports and 36 actions/24 routes/6 jobs; typecheck and the 75-page production build passed.
- F1-F7 regressions passed. F2 correlation/replay, F5 privacy/tenant isolation and F6 fake/budget/prompt-injection/fallback/idempotency suites passed on fresh isolated databases. Provider contracts made zero external calls; the dependency audit reported zero known production vulnerabilities and the secret scan covered 878 files with zero findings.
- Requirement ledger: 22 F8 requirements are `PASS`; `MET-006` and `SUP-001` are `READY_FOR_EXTERNAL_INPUT` for current verified real cost evidence and actual 5-10 pilot companies with at least five paid/signed/consented engagements. No F8 requirement is pending, blocked or waived.

Evidence: `docs/readiness/evidence/f8/audit-manifest.json`, `browser-validation.json`, the F8 validators, metrics/pilot contracts, operational methodology and migration `20260726200000_readiness_f8_metrics_pilots`.

## F9 - Public brand, legal surfaces and accepted Marketing V2 - PASS

Implemented on `feat/readiness-f9-public-brand` from program commit `9be9838afec3c0db1495e8aa80db087dc6e8f7e6`. Production, persistent staging and the OpenAI key workflow were not modified. Validation used only synthetic fixtures and an ephemeral standalone server on `127.0.0.1`.

- Integrated the accepted PR #24 source SHA `ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4` as the explicit second parent of merge `b5e063b5b5bb8efcfd04da3723e068747f679e2b`, after the F0 isolated preview and teardown. `/marketing-v2` and `/demo-v2` occur once in the route manifest and remain noindex rollback aliases.
- Promoted the accepted visual system to canonical `/` and `/demo`. The public message is construction/renovation/installations first; the internal multisector catalog remains configurable but is no longer the home message.
- The canonical 15-minute synthetic story now follows exactly lead, visit, quote, work, expense, invoice and collection, with visible review/confirmation and no provider request.
- Brand configuration now covers product/assistant names, legal identity, tagline, theme colors, marks, social assets, PWA identity and sender labels. Public metadata and legacy email subjects use that configuration; PDFs retain verified tenant logo/color input.
- Public pricing remains fail-closed and requires the flag, approval reference, catalog version and external mappings together. The public plans surface contains no subscription amount.
- Legal pages are versioned parameterized drafts marked `REVIEW_REQUIRED`; they describe live email, billing and provider behavior as gated and never claim inactive services as configured.
- The CMP is absent when no nonessential category is available. With first-party analytics available, the reporter mounts only after explicit acceptance; reject/withdraw controls passed with zero traffic before choice and after rejection.
- F9 pure validation passed 61/61 plus the noindex/indexable transition suite. The production build generated 77 pages. Browser validation passed 18/18 route/viewport combinations at 390x844 and 1440x900 with HTTP 200, zero overflow, broken images, critical/serious axe findings, console errors, valid request failures and external requests.
- Requirement ledger: all eight F9 requirements are `PASS`; no F9 requirement is pending, blocked, waived or waiting for external input. Brand/domain clearance and final legal approval remain explicit F11 release gates; `PUBLIC_INDEXING_ENABLED=false` is unchanged.

Evidence: `docs/readiness/evidence/f9/audit-manifest.json`, `browser-validation.json` and the F9 public/browser validators.

## F10 - Mobile wrapper and distribution readiness - PASS WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f10-mobile-distribution` from program commit `5f4dbcf5b77169f8ade7190daef1b3611a622de1`. Production, persistent staging, stores and signing systems were not modified. No keystore, certificate, provisioning profile or secret was created, loaded or printed.

- Defined the Capacitor wrapper as a network client of the configured web backend; the backend remains the source of truth for session, tenant context, data, files and effects. No native credential or business database is embedded.
- Development, staging and release are explicit. Release rejects HTTP, loopback/private, credential-bearing, mismatched and staging hosts; no URL is assumed when configuration is absent.
- Added allowlisted auth/open deep-link resolution, Android App Links, iOS Universal Links/custom scheme and fail-closed `.well-known` payloads. They return no association until the approved host and public certificate/team facts are configured.
- Preserved server-owned opaque HttpOnly/Secure/SameSite sessions and documented that the native layer stores no auth token. Device login/logout/rotation evidence remains external.
- Reduced Android to the `INTERNET` permission and app-scoped cache sharing; iOS declares no camera, microphone, photo, location or contacts prompt. System picker/share behavior still requires real-device evidence.
- Added a provider-neutral crash contract. One synthetic crash reached an injected fake transport with release SHA/code/fingerprint only; PII, content, route, stack, token, prompt and secret fields are rejected. No live crash provider was called.
- Added versioned store privacy/distribution contracts and a listing draft marked `PREPARED_NOT_SUBMITTED`/`NOT_SUBMITTED`, derived from the RAT without claiming tracking, advertising, sale, approval or publication.
- Android release tasks fail without all external signing inputs; iOS Release uses manual signing. The signing/rotation/backup runbook and artifact checksum tool never print or persist secret values.
- F10 pure validation passed 49/49 and the pre-existing mobile-config suite passed 22/22. Android Capacitor sync/doctor passed with an explicit loopback development URL whose generated config is ignored. iOS doctor stopped at the expected Windows/Xcode boundary; Gradle stopped because no JDK is installed. No signed AAB/XCArchive was fabricated.
- Requirement ledger: six F10 requirements are `PASS`; `MOB-003`, `MOB-004`, `MOB-005` and `MOB-009` are `READY_FOR_EXTERNAL_INPUT` for approved-domain/device E2E and signed artifacts. No F10 requirement is pending, blocked or waived.

Evidence: `docs/readiness/evidence/f10/audit-manifest.json`, mobile contracts, architecture/listing docs, signing runbook and F10 validator.

## F11 - Governance, CI, supply chain and transfer readiness - PASS WITH EXTERNAL INPUT GATES

Implemented on `feat/readiness-f11-governance` from program commit `736e9e47b44486abc426265b3cf8c453bfeef791`. Production, persistent staging, Railway, provider projects, stores and live credentials were not modified.

- Added four least-privilege GitHub workflows with every action pinned to a resolved 40-character SHA: application/database/browser CI, security/supply-chain, fail-closed Railway preview dispatch and non-deploying release-candidate evidence.
- Adopted Vitest and Playwright Test alongside all legacy validators. Vitest passed 3/3 with JUnit output; Playwright passed 2/2 for public reachability, noindex/robots, CSP enforcement and zero serious/critical axe findings.
- Fresh isolated PostgreSQL applied 43/43 migrations and the tenant/horizontal pentest passed 12/12 with zero high/critical findings, zero external calls and zero production/staging writes.
- Fiscal/XML goldens passed 12/12, commercial contracts 11/11 and privacy/security 18/18. Workflow YAML parsed 4/4 and dispatch simulations reported no provider mutation or deployment.
- Dependency audit reported zero vulnerabilities. The production license inventory found 485 locked packages, 22 direct, zero critical expressions and 14 review expressions. The reproducible CycloneDX 1.6 SBOM contains 779 components and 925 dependency rows; 145 unresolved nested references emitted by lockfile-only generation are recorded, not hidden.
- Typecheck passed, the production build generated 77/77 static pages and prepared standalone output, and the final secret scan covered 953 files with zero findings.
- Added proprietary LICENSE/NOTICE/contribution controls, third-party notices, ten ADRs, IP/asset/debt/known-issues registers and a strictly ignored private data-room boundary.
- The public technical data room links architecture, ERD, data dictionary, critical flows, operations/recovery, command catalog, support matrix and transition package. Readiness/release generators record full SHA, requirement/migration hashes and checksums without secrets or tenant content.
- The corrected requirement compiler accepts generic versioned external gates and persists all F7-F10 statuses in overrides. The ledger compiles 233 requirements: F11 has 29 `PASS` and seven `READY_FOR_EXTERNAL_INPUT`, with no pending/blocked/waived entry.
- External F11 gates are brand clearance, signed IP chain, real Railway preview, protected GitHub environment reviewers, real provider restore, private asset title and commercial handover terms. None is represented as technically completed.

Evidence: `docs/readiness/evidence/f11/audit-manifest.json`, tenant/license/readiness/release reports, F11 validators, pinned workflows and the public data-room index.

## Completion audit - cross-phase regression closure - PASS WITH EXTERNAL INPUT GATES

Executed on `codex/readiness-completion-audit` from integrated program SHA `94c395c73529cbfad1ac6be99e1b059c9bfcae07`. The audit compared the 233 canonical requirements with the supplied master prompt, required every evidence path to exist and then ran phase validators from F1 through F11 instead of trusting the F11-only green check.

- The first cross-phase run correctly failed F1 because F10 had introduced the mobile product name outside central brand configuration. Mobile app name, application ID and URL scheme now resolve through `lib/config/brand.ts`; F1 passes 56/56.
- The next run correctly failed context enforcement because the two F10 `.well-known` association routes lacked canonical request context. Both now use `publicRequestContext`; the positive/negative gate covers 36 action files, 26 route handlers and six job routes.
- CI now fetches full Git history, recompiles `requirements.yaml`, fails on a generated diff and runs `readiness:validate-all-static` across F1-F11 before typecheck/build. The full history is required for the F9 accepted-merge ancestry proof; F11 statics pass 45/45.
- The completed cross-phase run passed F1-F11; Vitest 3/3; Playwright 2/2 on loopback Chromium; typecheck; the 77-page production build; isolated tenant pentest 12/12 after 43/43 migrations; dependency audit with zero vulnerabilities; and secret scan over 954 files with zero findings.
- Requirement totals remain 203 `PASS`, 30 `READY_FOR_EXTERNAL_INPUT`, zero `PENDING`, zero `BLOCKED` and zero `WAIVED`. No external gate was reclassified or represented as completed.
- Production, persistent staging, Railway and provider projects were not modified. No deployment, real OpenAI call, live provider call, customer fixture, credential creation or secret exposure occurred.

Evidence: `docs/readiness/evidence/f11/completion-audit.json` and the updated F11 audit manifest.
