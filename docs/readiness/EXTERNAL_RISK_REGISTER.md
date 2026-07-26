# External risk register

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

## BRAND-DOMAIN-CLEARANCE-001

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
