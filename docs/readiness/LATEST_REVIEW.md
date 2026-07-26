# Latest continuous review

Status: `FAILED` — no review build is being represented as green yet.

- URL: `https://orqena-review-web-review.up.railway.app`
- Failed baseline SHA: `a68a025ddc9589e6e915780156c6191df590fe60`
- Failed deployment ID: `ad630afc-5c66-4616-95c3-eb591b06a287`
- Next candidate: `codex/orqena-external-closure` after the current atomic
  C0-C5 block is committed and pushed
- Updated: 2026-07-26 21:10 CEST
- Staging changed: no
- Production changed: no

## Baseline result

The immutable pre-existing source applied all 43 migrations and started, but
Railway health checks returned `503` because its standalone launcher inherited
Railway's container `HOSTNAME` instead of binding to `0.0.0.0`. The deployment
was therefore correctly rejected. The demonstrated launcher regression is
fixed in the next candidate and its focal migration-owner test passes.

The review project, environment, web service, PostgreSQL service/instance,
volume and domain remain isolated and persistent. Synthetic QA personas and a
one-time owner reset link will only be provisioned after a successful remote
health gate.

## Recommended routes

- `/`
- `/demo`
- `/producto`
- `/sectores`
- `/planes`
- `/seguridad`
- `/contacto`
- `/login`
- `/hoy` after using the separately delivered one-time synthetic access

## Known incidents

- `ad630afc-5c66-4616-95c3-eb591b06a287` is a failed baseline, not a visible
  green release. Its database migration completed; its web health check did not.
- The URL can be unavailable until the corrected candidate becomes `SUCCESS`.
- The local Lighthouse pass records home LCP `2623 ms`, above the specific C3
  target of `2500 ms`; C3 remains `IN_PROGRESS`.
- Real-user comprehension, representative production-like data, physical
  Safari/iOS and Chrome/Android devices, NVDA/VoiceOver assisted-device review,
  and approvals/signatures remain `READY_FOR_EXTERNAL_INPUT`.
