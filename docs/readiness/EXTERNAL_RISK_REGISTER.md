# External risk register

> **HISTORICAL SNAPSHOT / SUPERSEDED AS CANONICAL REGISTER — 2026-07-29.**
> Las entradas se conservan sin borrado para auditoría y no se consideran
> cerradas por la mera promoción de código. El registro canónico de decisiones
> y gates externos posteriores está en
> `docs/operations/EXTERNAL_DECISIONS_REGISTER.md`; el estado productivo está
> en `docs/readiness/PRODUCTION_STATE.md`.

## OPENAI-KEY-SETUP-UI

- Phase/control: F6 / AI-LIVE-001 through AI-LIVE-006
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: the secure local-save approval flow returned `not_approved` in three attempts.
- Confirmation: no key was created; no local file was written; no secret was exposed; staging and production were not modified.
- Cause classification: reproducible external interface/approval failure, not an implementation gap.
- Required resolution: complete the same secure Platform/local-save workflow in a future authorized session. Manual creation, paste, reuse or terminal/file alternatives are prohibited.
- Containment: all live controls remain individually gated; non-live implementation and fake/injected validation continue; global and company flags remain fail-closed.

No organization, project, selector or other sensitive identifier is recorded in this register.

## PILOT-LIVE-001

- Phase/control: F8 / SUP-001
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: the technical pilot program, cohort ledger, consent controls, onboarding timing, success criteria and handoff are complete and tested only with synthetic fixtures.
- Missing external evidence: 5-10 actual participant companies, at least 5 paid engagements, signed contracts, explicit consents and approved success criteria.
- Containment: fixtures never count as live pilots; no company is enrolled or contacted by this program branch.

## COST-BASELINE-001

- Phase/control: F8 / MET-006
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: the verified cost ledger and aggregate cost-to-serve calculation cover infrastructure, AI, storage, email and support by tenant, plan and period.
- Missing external evidence: current provider invoices, measured resource usage and approved support time records for the target environment.
- Containment: unverified costs are excluded; absence of a real baseline is displayed as missing evidence and is never replaced with an invented value.

## BRAND-LEGAL-001

- Phase/control: F11 / GOV-005
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: public identity, metadata, legal fields and white-label configuration are technically parameterized, but trademark clearance, definitive legal identity and proof of domain control require authorized legal/commercial evidence.
- Containment: `PUBLIC_INDEXING_ENABLED=false`; canonical public routes remain noindex and V2 aliases remain preserved for rollback. No domain, DNS, staging or production setting was changed.
- Required resolution: archive the authorized clearance decision and domain-control evidence before any indexing release gate can pass.

## MOBILE-LINK-001

- Phase/control: F10 / MOB-003
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: link allowlists, Android/iOS declarations and association payloads pass with synthetic facts; no approved domain certificate fingerprint or Apple team association was supplied.
- Containment: `.well-known` routes return 404 when configuration or host does not match; arbitrary hosts/routes are rejected.
- Required resolution: publish the approved association files and verify auth/open links on Android and iOS target devices.

## MOBILE-SESSION-001

- Phase/control: F10 / MOB-004
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: server session creation, rotation and revocation pass, and the wrapper stores no native credential. Target WebView behavior was not executed on physical/simulator Android and iOS devices.
- Containment: authentication remains server-owned through opaque cookies; no fallback token storage was introduced.

## MOBILE-FILES-001

- Phase/control: F10 / MOB-005
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: permission declarations and app-scoped file paths pass, but real PDF, download, picker upload and share behavior needs target-device evidence.
- Containment: Android declares only INTERNET, iOS has no unnecessary permission prompt and broad external storage paths are forbidden.

## MOBILE-BUILD-001

- Phase/control: F10 / MOB-009
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: build/signing guards and checksum manifest generation are implemented, but no signed AAB or XCArchive was built.
- Missing external capability: approved signing material, Android JDK/toolchain and protected macOS/Xcode runner.
- Containment: release tasks fail when signing inputs are incomplete; store state remains NOT_SUBMITTED and no artifact/publication is claimed.

## IP-CHAIN-001

- Phase/control: F11 / GOV-007
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: contribution and AI-assistance fields, review rules and the ignored private evidence boundary are complete.
- Missing external evidence: signed employment, contractor or contributor assignments for the exact release scope.
- Containment: the repository makes no ownership warranty and accepts no external contribution solely because it was merged.

## RAILWAY-PREVIEW-001

- Phase/control: F11 / CI-011
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: the manual dispatch validates PR number, immutable SHA and explicit isolation approval, then performs no provider mutation.
- Missing external evidence: provision, isolation proof and teardown of an actual Railway PR environment using resources distinct from staging and production.
- Containment: no Railway credential is present in the workflow and no staging/production resource was queried or modified.

## RELEASE-APPROVAL-001

- Phase/control: F11 / CI-012
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: the release-candidate workflow checks a full SHA and approval reference and only builds evidence.
- Missing external evidence: repository-admin configuration of required reviewers on the staging and production GitHub environments.
- Containment: the workflow cannot deploy and requires an explicit `confirm_no_deploy` input.

## REVIEW-PERFORMANCE-001

- Phase/control: C3 / public experience budget
- Status: `PASS` automatizado / riesgo productivo no asumido
- Resolution: los replays remotos exactos midieron LCP mediano 2200 ms en
  Review y 2180 ms en staging, con CLS 0 e INP 24 ms, frente a presupuestos
  2500/0,1/200. El umbral no se rebajó.
- Evidence: `docs/design/evidence/D10_REVIEW_EVIDENCE.json` y
  `docs/design/evidence/D11_STAGING_EVIDENCE.json`.
- Containment: el PASS es de experiencia automatizada del candidato; no es una
  afirmación de capacidad, disponibilidad o rendimiento productivo.

## AUTHENTICATED-MANUAL-001

- Phase/control: C5 / V5
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: la automatización cubre perfiles sintéticos, permisos, viewports, estados, teclado y axe; no sustituye lectores de pantalla, zoom real ni dispositivos físicos.
- Missing external evidence: NVDA y VoiceOver, Safari/iOS y Chrome/Android físicos, zoom 200%/400% real y aprobación humana de baselines.
- Containment: los resultados automatizados se publican como subcontroles separados y ninguna prueba manual se representa como PASS.

## REPRESENTATIVE-MIGRATION-001

- Phase/control: C7 / C10
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: el restore lógico de datos sintéticos aislados pasó, pero no existe un snapshot representativo autorizado para el ensayo de migración previo a producción.
- Missing external evidence: copia protegida y preferiblemente anonimizada, autorización de uso, criterios de reconciliación y propietario del go/no-go.
- Containment: el restore sintético no desbloquea staging ni producción y no se usa como sustituto del backup/PITR nativo.

## DR-RESTORE-001

- Phase/control: F11 / DATA-003
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: el 2026-07-26 pasó un backup/restore lógico remoto, transaccional y con checksum, en un servicio PostgreSQL hermano del `review` persistente. Se verificaron 43 migraciones, huella de 780 objetos de esquema, conteos de 155 tablas y cero relaciones tenant huérfanas; el origen no se sustituyó ni repuntó.
- Cleanup evidence: el servicio y volumen temporales ya no aparecen en el entorno; sólo permanecen el web y PostgreSQL dedicados de review. El dump y los clientes PostgreSQL temporales se eliminaron después de la verificación.
- Missing external evidence: política nativa de backup/PITR y restore nativo del proveedor. Railway mostró que esta capacidad requiere Pro mientras el entorno observado está en Hobby.
- Containment: el resultado lógico no se presenta como prueba de PITR ni como ensayo de migración con datos representativos de producción; producción y staging no se tocaron.

## ASSET-TITLE-001

- Phase/control: F11 / DATA-007
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: transferable and non-transferable asset classes and the private title schedule fields are defined.
- Missing external evidence: signed title/assignment schedule for code, designs, demo data and authored assets.
- Containment: accounts, credentials, provider contracts, customer data and third-party rights are explicitly excluded absent written transfer.

## HANDOVER-COMMERCIAL-001

- Phase/control: F11 / DATA-008
- Status: `READY_FOR_EXTERNAL_INPUT`
- Observation: technical handover contents and acceptance gates are defined.
- Missing external decision: included hours, personnel, response windows, dates and commercial terms.
- Containment: no hours, price, staffing or SLA is invented in repository evidence.
