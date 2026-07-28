# C5 and V4–V6 audit matrix

The versioned scope is `contracts/qa/v1/surface-matrix.json`. Presence in the
contract is not evidence; the summarized remote evidence is
`docs/readiness/evidence/c5/remote-authenticated-summary.json`.

## Automated result

The remote automated matrix passed against application SHA
`d22b42454d10baff0873e5a1afccf85db9bf49a5`:

- 11 synthetic profiles and 66 profile/viewport home cases;
- 21 positive/negative server-authorization cases;
- 46 authenticated OWNER surface families;
- 89 axe cases and 10 distinct portal navigation signatures;
- populated, responsive, read-only, restricted and privileged-MFA states;
- empty, loading, error/retry/recovery, offline/recovery, representative
  keyboard and 320 px reflow-equivalent cases;
- authenticated bursts on `/hoy`, `/dashboard` and `/clientes`;
- zero blocking findings and zero HTTP 5xx during the successful interval.

This closes the automated V5 subcontrol. C5 as a whole is
`READY_FOR_EXTERNAL_INPUT`, not PASS, because the following still need signed
human/hardware evidence:

- Safari on physical iOS and Chrome on physical Android;
- NVDA and VoiceOver journeys;
- real 200% and 400% zoom inspection;
- human approval of visual-regression baselines.

## Demonstrated regressions and repairs

The first batch demonstrated nested `main` landmarks, missing page headings and
upload/privacy labels, plus one incorrect expectation for the external
collaborator's safe inline denial. The next batch reduced the result to one
synthetic error-state diagnostic; after exact classification, the following
attempt exposed production route-bundle pool multiplication. The process-global
Prisma singleton and bounded review pool repaired it.

The final repetition exposed a false-green clock injection in the F5 MFA test:
`otplib` v13 accepts epoch seconds, while the deterministic path passed
milliseconds. The unit is corrected in implementation and focal test; the
isolated 43-migration F5 suite passes 12/12.

## Nonblocking observations

Thirteen OWNER routes display more than one primary-styled action. They cover
budget detail/templates, invoice detail, treasury, subcontractors, supplier and
subcontractor invoices, task list/detail, recommendations, settings, support
and platform health. They are explicit product-design observations, not hidden
authorization or accessibility passes.

The runner provisions only synthetic tenants and role accounts behind exact
Railway project/environment/database guards. Passwords and TOTP material stay
in process memory; reports and screenshots omit credentials, and the separately
delivered one-use reset URL is never committed.
