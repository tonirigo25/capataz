# Lead capture, retention and abuse

Status: technical path implemented; environment activation is
`READY_FOR_EXTERNAL_INPUT`.

The public form collects only contact, company, sector, team band, need,
consent and bounded attribution. It does not accept passwords, credentials or
sensitive business files. Duplicate submissions receive the same opaque
response as first submissions. The public response never exposes a lead ID,
replay state or email existence.

Abuse controls include payload and media-type limits, per-source/email rate
limiting, a hidden honeypot and bounded link/repetition heuristics. Suspected
bots receive the same accepted response but are not stored. This is deliberately
not presented as complete anti-spam protection.

The platform OWNER queue provides explicit states and an audited reason for
every management change. `IN_REVIEW`, `QUALIFIED`, `CONVERTED` and
`LEGAL_HOLD` are protected from the automated retention job. `PENDING`,
`DECLINED` and `SPAM` older than `DEMO_LEAD_RETENTION_DAYS` are candidates.

The scheduled proactive endpoint invokes the retention function only when
`DEMO_LEAD_RETENTION_ENABLED=true`. The default is `false`; activation requires
privacy-owner approval and a dry run in the isolated preview. The bounded
retention window is 30–3650 days and defaults to 90. Every applied run writes a
minimized audit record with counts, never lead contents.
