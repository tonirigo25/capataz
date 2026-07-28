# C6 provider activation ledger

Status: `READY_FOR_EXTERNAL_INPUT`.

The executable contracts, fake/injected adapters, human-confirmation controls,
redaction, idempotency and rollback runbooks are present. They do not prove a
live provider. The current release candidate keeps every provider in an
independent fail-closed wave:

| Provider | Current live state | Technical gate | Remaining live gate |
| --- | --- | --- | --- |
| OpenAI | off | governed fake transport, strict schemas, budgets, redaction and human review pass | new scoped key, approved data profile, live synthetic smoke and budget alerts |
| Email | off | transactional outbox, replay, suppression and token minimization pass | approved domain, SPF, DKIM, DMARC, sender/reply-to and bounded provider account |
| Billing | off | sandbox-neutral contracts, idempotency and reconciliation pass | approved Stripe sandbox, catalog/Price mappings, tax treatment and webhook |
| Storage | local review volume only | tenant isolation, signed access, hashes and local restore logic pass | approved external bucket/lifecycle/CORS/malware/backup configuration |
| Observability | no remote exporter | redacted tracing, health and threshold contracts pass | approved remote project, retention, alert recipients and synthetic event |
| Fiscal | transmission off | deterministic local engine, validators, immutable evidence and provider contract pass | signed fiscal review, authorized certificate and sandbox/provider receipt |

`contracts/release/v1/provider-activation-gates.json` is the machine-readable
source. A provider may change to `PASS` only after its own real smoke,
reconciliation and rollback evidence. Success in one wave cannot authorize any
other wave. Public indexing, public registration and public pricing are
separate gates and remain off.
