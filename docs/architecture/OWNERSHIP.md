# Technical ownership

The repository owner is the default accountable owner. Sensitive modules add explicit specialist review; no production-critical path is unowned.

| Surface | Accountable owner | Required reviewer |
| --- | --- | --- |
| Whole repository fallback | `@tonirigo25` | `@tonirigo25` |
| Identity, tenant isolation, permissions | `@tonirigo25` | security reviewer before production |
| Fiscal ledger and electronic invoicing | `@tonirigo25` | fiscal/legal reviewer before live mode |
| Billing and webhooks | `@tonirigo25` | finance/security reviewer before live mode |
| Email and public communications | `@tonirigo25` | deliverability/privacy reviewer before live mode |
| Privacy, retention, storage | `@tonirigo25` | privacy/security reviewer before production |
| AI prompts, policy and evaluations | `@tonirigo25` | AI governance reviewer before live mode |
| Migrations and release automation | `@tonirigo25` | database/release reviewer |

External specialist roles are gates, not fictitious GitHub accounts. Until a named reviewer is supplied, the related requirement is `READY_FOR_EXTERNAL_INPUT` and its live flag remains off.
