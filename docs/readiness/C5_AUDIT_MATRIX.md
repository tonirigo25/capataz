# C5 and V4–V6 audit matrix

The versioned scope is `contracts/qa/v1/surface-matrix.json`. It lists public
routes, authenticated families, profiles, viewports, themes, motion modes and
application states. Presence in the matrix is not a `PASS`.

Automated local/CI coverage uses Chromium, Firefox and WebKit engines.
Chromium additionally covers 320/390/768/1024/1440/1920 widths, noindex,
broken media, reduced motion and candidate screenshots. Lighthouse CI and a
throttled Chromium probe provide repeatable performance gates.

The first remote authenticated batch against deployed SHA
`766bbfeb17d399883113e83a959ce73326689d31` intentionally finished `FAILED`:

- 11 synthetic profiles and 66 profile/viewport home cases;
- 22 positive/negative authorization cases;
- 46 authenticated owner surface families;
- 90 axe cases;
- 112 sanitized screenshots;
- 10 distinct portal navigation signatures;
- 63 blocking findings and 12 product observations.

The batch demonstrated a shared nested-`main` regression, eight missing
screen-level headings, two missing upload labels, one unnamed privacy select
and a mistaken test expectation for the external collaborator's safe inline
Orqena denial. The shared semantics and explicit labels are corrected in the
next candidate. Nine contrast/label axe cases and one sporadic hydration
diagnostic remain subject to selector-level rerun evidence. None is recorded as
PASS.

The review runner provisions only synthetic tenants and role accounts behind
exact Railway project/environment/database guards. Password and TOTP handoffs
remain in process memory, screenshots and JSON omit cookies/credentials, and a
separately delivered one-use owner reset URL is not committed. PLATFORM_OWNER
coverage must complete the real TOTP challenge before platform pages are
audited.

The following stay `READY_FOR_EXTERNAL_INPUT` until executed with signed
evidence:

- Safari on physical iOS and Chrome on physical Android;
- NVDA and VoiceOver journeys;
- 200% and 400% zoom inspection;
- human approval of visual-regression baselines;
- physical-device and assisted-technology portions of the authenticated
  profile/state matrix.

Automated authenticated coverage remains `IN_PROGRESS`: the populated,
responsive, read-only, restricted and privileged-MFA batches exist; empty,
loading, error, offline, zoom and keyboard batches are not yet closed.

The immersive public journey may use sticky storytelling, but automated checks
must prove no mandatory scroll snapping or hidden reduced-motion content.
Operational SaaS routes may use sticky context only where it reduces work; they
must not use decorative scroll control.
