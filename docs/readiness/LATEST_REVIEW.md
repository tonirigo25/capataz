# Latest continuous review

> **HISTORICAL / SUPERSEDED — 2026-07-29.** This is the last pre-production
> Review/Staging snapshot. Current Production truth is recorded in
> `docs/readiness/PRODUCTION_STATE.md`.

Historical status: `SUCCESS` for the persistent isolated review service. The
exact D11 candidate also passed staging; production promotion was still
`NO-GO` when this snapshot was written.

- Stable Review URL: `https://orqena-review-web-review.up.railway.app`
- Last fully audited functional SHA:
  `2be6a99040c70c67fe2f91c0737f4c17bd116451`
- Review deployment: `ce516232-0c3e-438f-b276-64773e07ac7d`
- Staging URL: `https://orqena-web-staging.up.railway.app`
- Staging deployment: `b4603964-09a0-421a-9d09-f0e96fff7ceb`
- Updated: 2026-07-28 18:05 CEST
- Staging changed: yes, deliberately to the exact green candidate
- Production changed: no

## Remote evidence

- Review and staging report 43 tracked migrations and zero pending on the
  final exact deploy. Live, ready and status return 200; `robots.txt` disallows
  `/` and responses remain globally `noindex`.
- Public staging matrix: 24 routes, eight viewports from 320 to 1920 px and
  Chromium/Firefox/WebKit; 576 cases, 576 Axe, 24 captures, 12 diffs, seven
  media cases and zero blocking findings.
- Remote median performance passes the versioned budget: LCP 2180 ms, CLS 0
  and INP 24 ms.
- Authenticated staging matrix: four focal profiles, eight viewports, three
  engines, four logins, 96 profile cases, 264 OWNER surface cases, 360 Axe and
  60 captures; zero observations and zero blocking findings.
- The selected journey captured 25 surfaces with 25 distinct hashes and
  verified cross-tenant denial, OWNER-only governance, assigned/unassigned
  scope, read-only denial and invitation acceptance plus owner approval.
- The final two-hour Review/staging window contains zero HTTP 5xx. These tests
  use synthetic data and are not production-capacity or availability claims.
- A one-use OWNER reset URL is delivered separately. Password, TOTP, cookie and
  reset token are not committed to Git or evidence.

## Visible changes

- Orqena Field OS tokens, typography, spacing, responsive shell, navigation
  hierarchy and contextual capture controls.
- Reworked public journey, demo, product/status surfaces and 320–1920
  responsive behavior.
- Role-aware Hoy/Dashboard, Clientes 360, work/money, documents/procurement,
  operation, Orqena, team, onboarding, settings and governance surfaces.
- 93/93 route/state matrix with loading, empty, error, restricted, read-only,
  demo, archive and confirmation contracts.
- Fail-closed indexing, registration and provider boundaries; business,
  fiscal, tenant, authorization, payment and AI rules remain unchanged.
- Railway upload frontier now excludes local QA backups, worktrees and ignored
  browser artifacts.

## Recommended routes

- Public: `/`, `/demo`, `/producto`, `/estado`, `/soluciones`, `/sectores`,
  `/planes`, `/seguridad`, `/contacto`.
- Authenticated after using the separately delivered one-use access: `/login`,
  `/hoy`, `/dashboard`, `/clientes`, `/obras`, `/dinero`, `/documentos`,
  `/agenda`, `/capataz`, `/equipo`, `/configuracion`, `/auditoria`.

## Known observations and open gates

- Ten offscreen target-size findings passed after scrolling their targets into
  view; two isolated React #418 diagnostics passed replay in fresh contexts.
  Neither is suppressed or generalized into an exemption.
- One full-page journey capture of `/` timed out under three concurrent
  runners and used a viewport fallback. The route returned 200 and independently
  passed all 24 engine/viewport combinations.
- Physical Safari/iOS, Chrome/Android, NVDA, VoiceOver, real zoom and
  user/device validation remain `READY_FOR_EXTERNAL_INPUT`.
- Representative production-data rehearsal, native backup/PITR and restore,
  immutable main/tag and signed human go/no-go remain
  `READY_FOR_EXTERNAL_INPUT`.
- Public indexing, live billing, live email, live fiscal transmission, AI,
  analytics and every other live provider remain disabled.
