# ADR 0008: provider-owned billing, transactional email and private assets

Status: accepted for F4 on 2026-07-26.

## Decision

Orqena keeps internal Plan and entitlement records as the source of product authorization, while Stripe identifiers live only in `BillingPriceMapping`, `BillingCustomer` and provider projections. Checkout and customer-portal creation require an authenticated OWNER, an HTTPS return URL and a tenant-scoped idempotency record. Signed webhooks are the only provider-to-local status transition path. Payment failure has a seven-day grace period, then server mutations become read-only; overuse is blocked or explicitly approved and never charged silently.

All application email enters `EmailOutbox` in the same transaction as its business event. Workers claim with PostgreSQL `FOR UPDATE SKIP LOCKED`, render a versioned allowlisted template only in memory, call an injected provider, and persist delivery metadata. Action tokens are deterministic HMAC values derived from the outbox ID and a server secret: only their one-way application hash is stored. Bounce, complaint and suppression webhooks prevent later sends. Tracking defaults off.

`DocumentStorage` remains for legacy documents. New company assets use `StorageProvider`, a private tenant prefix, a `StoredObject` integrity record and an HMAC grant valid for at most 15 minutes. Logo and seal settings accept only uploaded PNG/JPEG/WebP objects; document routes no longer consume arbitrary URLs, eliminating the prior SSRF surface.

## Boundaries

- Billing, live email and S3 remain disabled until their independent configuration gates pass.
- Provider doubles are mandatory in validation; F4 makes no live charge, email or object-storage request.
- Reconciliation is audit-only. It records divergence and never overwrites local state without a separately authorized operation.
- Production and persistent staging are outside F4's mutation scope.

## Rollback

Disable `BILLING_ENABLED` and `EMAIL_LIVE_ENABLED`, select local providers outside production, and stop the worker schedule. Schema changes are additive. Provider events, delivery attempts and object integrity evidence are retained; rollback is logical rather than destructive.
