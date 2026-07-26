# ADR 0009: Privacy governance and minimized evidence

Status: accepted for readiness F11.

Personal data, secrets, prompts and tenant content are excluded from CI artifacts,
readiness reports and the public data room. Operational evidence uses allowlisted
counts, hashes, pseudonymous references and explicit synthetic fixtures. Private
legal evidence is kept outside Git and referenced by non-secret IDs only.

This decision is hard to reverse after distribution because copied artifacts
cannot reliably be recalled. Therefore every new reporter or artifact generator
must fail closed on unknown fields and pass secret/PII review before adoption.
