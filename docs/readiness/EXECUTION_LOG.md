# Orqena production readiness execution log

## Program baseline

- Program branch: `program/orqena-production-readiness`
- Base ref: `origin/main`
- Base SHA: `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`
- Master input SHA-256: `584291DE898BD15FBC49DD15CD6F98061195F8AB4B6702323725AB9C7C98E8ED`
- Normalized tracked prompt SHA-256: `AB5BAD912067733EF514EE834C816B7AB5BB69BCCDF050370609E12CEEB892C2`
- Requirement ledger: 233 unique requirements in `docs/readiness/requirements.yaml`
- Production writes: forbidden during development unless separately authorized.

## F0 - Marketing V2 preview closure - PASS

Captured on 2026-07-25 in an isolated Railway environment created from staging and deleted after evidence capture.

- PR #24 remained `OPEN` and `DRAFT` on `feat/capataz-marketing-v2` at `ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4`.
- GitHub author was a human `User`; repository permission was `admin`.
- Preview environment: `capataz-review-pr-24` (`cb9f5ffe-6f86-4f45-ae70-e2f60a6f99a4`).
- Final preview web deployment: `6c991616-a5f9-46bd-b629-977caf960d7c`, `SUCCESS`, exact PR SHA.
- Preview Postgres deployment: `72d0ffc2-1784-4d55-9fc8-2cf29e8fd742`, `SUCCESS`.
- `DATABASE_URL` was an internal reference in the preview and contained no production reference.
- Database gate: 25 migrations found, zero pending.
- `/marketing-v2`, `/demo-v2`, `/`, `/demo`, `/login`, `/hoy`, and `/api/status` returned HTTP 200 after redirects where applicable.
- V2 routes retained `noindex, nofollow, noarchive, nosnippet`; sitemap had zero URLs and robots disallowed crawling.
- Browser gate passed at requested 390x844 and 1440x900 viewports: no horizontal overflow, broken images, console warnings/errors, valid-load network failures, or `/api/` calls from V2.
- Guided demo passed all six steps and the explicit simulated confirmation with zero network requests.
- Local gates passed: typecheck, production build, public-indexing suite, and `git diff --check`.
- Staging stayed on deployment `dc3ce593-3bc8-4abb-9167-9b9d2f774549`.
- Production stayed on deployment `2e266e66-be53-4008-a1b9-cbfaca21c750`, SHA `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`.
- Teardown passed: the preview environment, services, volume instances, and Railway domain were removed.
- Temporary resources were one web instance, one PostgreSQL instance, and two empty 5 GB volume instances; Railway CLI did not expose an exact accrued cost.
- No secret value was printed or committed.

Evidence: `docs/readiness/evidence/f0/audit-manifest.json` and the four hashed PNG captures in the same directory.

## F1 - Contract freeze - IN PROGRESS

Started from the clean program baseline after F0 teardown. No production, staging, PR #24, or Marketing V2 branch mutation is permitted in this phase.
