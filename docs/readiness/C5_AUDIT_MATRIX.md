# C5 and V4–V6 audit matrix

The versioned scope is `contracts/qa/v1/surface-matrix.json`. It lists public
routes, authenticated families, profiles, viewports, themes, motion modes and
application states. Presence in the matrix is not a `PASS`.

Automated local/CI coverage uses Chromium, Firefox and WebKit engines.
Chromium additionally covers 320/390/768/1024/1440/1920 widths, noindex,
broken media, reduced motion and candidate screenshots. Lighthouse CI and a
throttled Chromium probe provide repeatable performance gates.

The following stay `READY_FOR_EXTERNAL_INPUT` until executed with signed
evidence:

- Safari on physical iOS and Chrome on physical Android;
- NVDA and VoiceOver journeys;
- 200% and 400% zoom inspection;
- human approval of visual-regression baselines;
- the full authenticated profile/state matrix on review.

The immersive public journey may use sticky storytelling, but automated checks
must prove no mandatory scroll snapping or hidden reduced-motion content.
Operational SaaS routes may use sticky context only where it reduces work; they
must not use decorative scroll control.
