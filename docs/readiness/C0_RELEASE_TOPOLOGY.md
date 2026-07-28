# C0 release topology

Status: `PASS` for the technical preflight. No production or persistent-staging
mutation was performed.

## Frozen source

- Repository: `tonirigo25/capataz`.
- Existing production/main SHA: `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`.
- Immutable program source SHA: `a68a025ddc9589e6e915780156c6191df590fe60`.
- Candidate tag: `orqena-rc-2026.07.1`.
- Working branch for external closure: `codex/orqena-external-closure`.

The generated manifest records the full asymmetric comparison, merge base,
commit list and migrations. It must be regenerated with
`npm run readiness:c0-manifest` and committed output must remain unchanged.

## Superseded PR

PR #24 was closed without merge on 2026-07-26. Its branch remains available.
The recorded comment is:

`superseded by the explicit F9 merge in program/orqena-production-readiness`

## Production observation

Railway deployment `2e266e66-be53-4008-a1b9-cbfaca21c750` was observed
`SUCCESS` and running `main` at `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`.
The public `/api/status` endpoint also returned healthy. This is a read-only
observation, not a release or deployment.

## Identity and domain

Orqena is the canonical visible product identity. `/capataz`, `CAPATAZ_*` and
selected internal filenames remain compatibility aliases and are not a second
public brand. Examples use `.invalid` until domain control and brand/legal
clearance exist.

## Repository visibility decision

The repository is currently public while `LICENSE` is proprietary. The notice
reserves rights but does not reverse existing source exposure. Before buyer
diligence or distribution of private evidence, the recommended default is to
make the repository private unless counsel explicitly approves continued
public visibility. The visibility change is not a technical decision and was
not performed.

## Addendum controls

- D1 is `READY_FOR_EXTERNAL_INPUT`: the isolated empty-database migration
  passed, but no authorized representative production snapshot was supplied.
  The executable and evidence requirements are in
  `D1_REPRESENTATIVE_DATA_MIGRATION.md`.
- D2 is governed by `contracts/release/v1/feature-flags.json` and
  `RELEASE_COMPATIBILITY_MATRIX.md`. It remains in progress until its automated
  validator and the candidate PWA/browser checks pass.
