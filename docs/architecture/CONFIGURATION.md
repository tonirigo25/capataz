# Configuration contract

`lib/config` is the typed source for public, server, environment, and brand configuration. `scripts/readiness/validate-runtime-config.mjs` enforces the equivalent fail-closed checks before the standalone server starts.

## Defaults

All new engines are disabled: fiscal, billing, live email, AI, analytics, and public indexing. Company overrides can only narrow or deliberately enable an environment-approved capability through `FeatureFlag`; a missing row is never an enablement.

## Production gates

- Canonical URL: HTTPS, approved custom domain, never localhost or a preview domain.
- Identity: product, legal entity, and tax identifier are mandatory.
- Storage: private object storage; local/public storage is rejected.
- Live email: approved sender/domain plus provider and webhook secrets.
- Billing: provider secret, webhook secret, and explicit price mappings.
- Fiscal live: approved provider, certificate reference, and software version.
- AI: provider key and approved data profile.

Validation messages name missing variables but never values. Secrets remain server-only and must be configured through the deployment platform.
