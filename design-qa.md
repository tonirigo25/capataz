# Design QA — Public desktop layout Revision 6

## Visual source of truth

- Existing approved public direction on branch `design/orqena-field-os-v2`.
- Preserved home split hero: copy left, interactive Orqena product right.
- Baseline captures: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/baseline-390/` and `baseline-1440/`.

## Implementation evidence

- 46 routes at `390 × 844`: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/final-390/`.
- 46 routes at `1440 × 1000`: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/final-1440/`.
- 46 routes at `1920 × 1080`: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/final-1920/`.
- Combined responsive comparisons: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/comparisons/`.
- Twelve-column grid and hero annotation: `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/annotated-1440/`.

## QA passes

| Pass | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| Layout | Home and Product already had the intended copy/visual balance. | — | Preserved; only a stable layout marker was added to Home. |
| Layout | Several no-visual pages inherited a split grid and left half the hero empty. | P1 | Assigned `centered`; content now occupies a deliberate 760–900 px measure. |
| Layout | Dynamic product and sector pages used bespoke hero widths and duplicated the main visual. | P1 | Moved to the shared `split` contract and kept each real module/sector scene. |
| Layout | `/soluciones` briefly lost its strong right-hand visual in a wide editorial treatment. | P1 | Reverted to `split`; the known-good pattern is preserved. |
| Responsive | Contact requires a form at the right on desktop and a natural sequence on mobile. | P1 | Shared `split` stacks copy, actions and form at 390 px without clipping or overlap. |
| Navigation | The top-left Orqena Tech wordmark pointed to `#top` on inner pages. | P1 | It now points to `/` with an explicit accessible label. |
| Typography | No-visual titles were visually stranded at the left edge on wide screens. | P2 | Centered and wide-editorial variants share a 1280 px grid and bounded copy measure. |
| Accessibility | Breakpoint corrections could have changed source order. | P1 | DOM order remains copy then visual; focusable controls and labels are unchanged. |

## Visual judgment

The combined comparisons were inspected for typography, wrapping, margins, card density, real product imagery, button hierarchy, responsive stacking and dead space. The split pages preserve the product-led composition; centered pages no longer look like mobile screens stretched across desktop; editorial pages use the available grid without decorative filler.

## Final result

`passed`

No unresolved P0, P1 or P2 visual finding remains in the Revision 6 scope.
