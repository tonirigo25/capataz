export function selectDiffViewportKeys({ viewports, screenshotViewportKeys }) {
  return ["390", "768", "1024", "1440"]
    .filter((key) => viewports.some((viewport) => viewport.key === key) && screenshotViewportKeys.has(key));
}
