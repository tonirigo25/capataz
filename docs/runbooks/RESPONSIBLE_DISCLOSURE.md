# Responsible disclosure launch gate

Status: `READY_FOR_EXTERNAL_INPUT`.

Orqena does not currently publish `/.well-known/security.txt`. Publishing a
contact that is not monitored would create a false operational promise.

Before publication, an authorized security owner must provide and test:

- a dedicated monitored mailbox or intake system;
- ownership, backup coverage and an escalation rota;
- safe-harbour and scope wording approved by counsel;
- supported languages, encryption key, expected acknowledgement window and
  disclosure policy;
- an end-to-end synthetic report showing receipt, triage, acknowledgement,
  severity assignment, remediation owner and closure;
- expiry and review dates for the `security.txt` content.

Only after that evidence exists may the route be added. The security page must
then link to it, and monitoring must alert when the channel cannot receive or
assign reports. Until then, general contact and demo forms must not be
represented as vulnerability-reporting channels.
