# Provider degradation and fail-closed operation

External providers are optional and disabled by default. A disabled provider
must not be replaced with a fabricated success.

| Provider | Detection | User-visible behavior | Immediate stop | Recovery evidence |
| --- | --- | --- | --- | --- |
| Email | Outbox age, retry/dead-letter counts, webhook verification | Keep event pending and explain that live email is unavailable | `EMAIL_LIVE_ENABLED=false` | Synthetic send, delivery webhook and no duplicate |
| Billing | API/webhook errors and stale subscription state | Disable new checkout; retain last reconciled state | `BILLING_ENABLED=false` | Idempotent checkout/webhook and provider reconciliation |
| Fiscal | Provider receipt error, signature/config failure | Preserve draft/local evidence; never claim transmission | `FISCAL_ENGINE_ENABLED=false` | Specialist-approved document and accepted provider receipt |
| AI | Timeout, policy denial, provider error | Show deterministic manual/product path; no invented answer | `AI_ENABLED=false` plus company kill switch | Governed synthetic request, redaction and human-review result |
| Storage | Integrity, malware or provider availability error | Stop serving the affected object; keep metadata/audit | Disable affected upload/download path operationally | Hash verification, restore and tenant-bound access |
| Analytics | Endpoint unavailable or consent absent | Drop the optional event; core workflow continues | `ANALYTICS_ENABLED=false` | Consented synthetic event with no PII |

Incident handling follows `INCIDENT_RESPONSE.md`. Provider activation,
credential changes and production failover require explicit authorization.
