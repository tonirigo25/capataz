# Latest continuous review

Status: `SUCCESS` for the persistent isolated review service. Production
promotion remains `NO-GO`.

- Stable URL: `https://orqena-review-web-review.up.railway.app`
- Last fully audited application SHA:
  `d22b42454d10baff0873e5a1afccf85db9bf49a5`
- Successful deployment ID: `19ec8c69-9401-4c78-acae-9ae09842514c`
- Runtime SHA source of truth: `/api/status`
- Updated: 2026-07-26 23:53 CEST
- Staging changed: no
- Production changed: no

## Remote evidence

- The sole pre-deploy migration owner applied all 43 tracked migrations; none
  is pending. Live, ready, status and the public surface return HTTP `200` with
  global noindex.
- The public Playwright matrix passed 32 cases and explicitly skipped 28
  inapplicable cases across Chromium, Firefox and WebKit, widths 320–1920,
  reduced motion, axe, media, overflow and noindex.
- Two identical synthetic demo submissions persisted one lead, one audit event
  and one email-outbox entry. No live email was sent. The cross-site negative
  case returned `403` and persisted no row.
- The authenticated matrix passed 11 profiles, 66 profile/viewport cases, 21
  allow/deny cases, 46 OWNER surface families, 89 axe cases and all six state
  cases with zero blocking findings. Thirteen multiple-primary-action
  observations remain visible in the known-issues register.
- Authenticated synthetic bursts passed with zero failures: `/hoy` p95 724 ms,
  `/dashboard` 534 ms and `/clientes` 502 ms. Public bursts passed 30 requests
  per path at concurrency 10, with p95 between 302 and 524 ms and recovery
  between 203 and 217 ms. These are not production-capacity or availability
  claims.
- After the authenticated run the database reported 19 total connections, one
  active, ten idle and zero idle-in-transaction, against 100 maximum and three
  reserved. The successful audit interval contained zero HTTP 5xx.
- The logical sibling restore passed with checksum, 43 migrations, 780 schema
  objects, 155 tables and zero tenant relational orphans; its temporary service
  and volume were removed. It is not native PITR or a representative-production
  migration rehearsal.
- A one-use PLATFORM_OWNER reset URL is delivered separately. Password, TOTP,
  cookie and reset token are never committed to evidence.

## Visible changes

- Complete C0 identity/provenance, compatibility, closure and external-input
  ledgers.
- Consented persistent demo funnel with rate limiting, deduplication, audit,
  retention and outbox-only email.
- Seven-stage public story, product/solution/sector routes, ROI hypothesis
  calculator, diagnostic, trust, status, security and resource surfaces.
- Responsive role-specific portals, screen-level landmark/label repairs,
  deterministic empty/loading/error/offline/recovery probes and privileged MFA
  coverage.
- Railway standalone startup bound to `0.0.0.0`, reproducible npm 10 lockfile,
  process-global Prisma singleton and bounded review connection pool.
- Fail-closed gates for indexing, registration and every live provider.

## Recommended routes

- Public: `/`, `/demo`, `/producto`, `/soluciones`, `/sectores`, `/planes`,
  `/seguridad`, `/estado`, `/contacto`.
- Resources: `/recursos/calculadora-roi`,
  `/recursos/diagnostico-operativo`.
- Authenticated after using the separately delivered one-use access: `/login`,
  `/hoy`, `/dashboard`, `/clientes`, `/obras`, `/presupuestos`, `/dinero`,
  `/tesoreria`, `/tareas`, `/configuracion`.

## Known incidents and open gates

- The initial host binding and npm 10 lockfile failures are repaired and
  superseded by successful deployments.
- The first authenticated batch demonstrated shared landmarks/labels; the next
  batch exposed production route-bundle pool multiplication. Both have
  regression gates and remote evidence.
- The final MFA rerun exposed a deterministic-test epoch-unit bug
  (milliseconds versus seconds). The normal un-injected path was unaffected;
  the isolated F5 test now exercises the correct unit.
- Home Lighthouse LCP is `2623 ms` against the strict `2500 ms` C3 target, so
  C3 remains `IN_PROGRESS`.
- Physical devices, NVDA/VoiceOver, real zoom, real-user comprehension, legal
  and brand approvals, signed mobile artifacts, representative migration data,
  native backup/PITR, full staging and human go/no-go are
  `READY_FOR_EXTERNAL_INPUT`.
- Public indexing, live billing, live email, live fiscal transmission, AI,
  analytics and every other live provider remain disabled.
