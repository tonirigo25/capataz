export type MarketingComposition =
  | "split-editorial"
  | "product-stage"
  | "timeline-horizontal"
  | "mosaic"
  | "data-rail"
  | "interactive-tabs"
  | "device-duet"
  | "relationship-map"
  | "comparison";

export const marketingCompositionManifest = {
  home: [
    "split-editorial",
    "data-rail",
    "timeline-horizontal",
    "mosaic",
    "relationship-map",
    "interactive-tabs",
    "device-duet",
    "comparison",
  ],
  productFamilies: {
    relationship: ["relationship-map", "timeline-horizontal", "interactive-tabs"],
    operation: ["product-stage", "device-duet", "data-rail"],
    control: ["comparison", "mosaic", "timeline-horizontal"],
  },
  sectors: ["mosaic", "data-rail", "split-editorial"],
} satisfies Record<string, readonly MarketingComposition[] | Record<string, readonly MarketingComposition[]>>;

export function hasRepeatedComposition(sequence: readonly MarketingComposition[]) {
  return sequence.some((composition, index) =>
    index > 1 && composition === sequence[index - 1] && composition === sequence[index - 2],
  );
}
