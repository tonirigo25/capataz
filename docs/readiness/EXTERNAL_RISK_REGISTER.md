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
