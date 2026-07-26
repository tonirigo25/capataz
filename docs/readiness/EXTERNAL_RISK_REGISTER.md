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
