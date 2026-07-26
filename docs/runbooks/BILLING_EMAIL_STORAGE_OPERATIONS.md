# Billing, email and private-storage operations

## Default state

The safe default is billing off, live email off, local non-delivering email, and local private storage only outside production. Do not add live secrets or enable flags during development validation.

## Billing activation

1. Create Stripe Products/Prices outside the repository. Store mappings in `BillingPriceMapping`; never hardcode Price IDs in UI or source.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the approved mapping list without printing values.
3. Validate the exact environment, then set `BILLING_ENABLED=true`.
4. Configure the raw-body webhook at `/api/webhooks/stripe`.
5. Schedule a daily reconciliation that calls `reconcileBillingSubscription`; review `BillingReconciliationRun` rows with `DIVERGED`. The job is audit-only.
6. Verify OWNER checkout/portal, replay, all six status projections, grace/read-only behavior and a failed-payment notification in a disposable environment before any production activation.

Emergency stop: set `BILLING_ENABLED=false`. This blocks new checkout and webhook ingestion. It does not alter Stripe or erase evidence. Provider-side action requires separate authorization.

## Email activation

1. Complete the independent checklist in `docs/compliance/EMAIL_DOMAIN_ACTIVATION.md`.
2. Configure `APP_BASE_URL`, sender, reply-to, Resend secret/webhook secret, a 32-byte-or-longer token derivation secret, and `JOB_RUNNER_SECRET` without printing values.
3. Keep `EMAIL_TRACKING_ENABLED=false`; set `EMAIL_LIVE_ENABLED=true` only after the domain checklist is signed.
4. Configure the raw-body webhook at `/api/webhooks/resend`.
5. Schedule authenticated POSTs to `/api/jobs/email-outbox`. Monitor pending age, retries, dead letters, bounces, complaints and suppression count.
6. Replay a dead letter only through `replayDeadLetter` with an authorized administrator; the action is audited.

Emergency stop: set `EMAIL_LIVE_ENABLED=false` and stop the worker schedule. Queued mail remains durable and no token plaintext is present in the database.

## Private storage

Production requires `STORAGE_PROVIDER=s3`, an environment-specific private bucket, credentials scoped to that bucket and `STORAGE_SIGNING_SECRET`. Preview, staging and production must not share bucket, credentials or prefix. Downloads are issued only through `authorizeDownload`; grants expire in 30-900 seconds and responses are private/no-store.

On integrity failure, stop serving the object, retain its metadata, and open an incident. Never replace the stored hash to make a modified object pass. Antivirus quarantine, retention, backup and restore drills are F5 controls and are not claimed by this runbook.
