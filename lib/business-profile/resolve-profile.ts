import { sectorProfiles } from "./sectors";
import type { SectorKey, SectorProfile, SectorTerminology } from "./types";

export type BusinessProfileInput = { sectorKey?: string | null; terminologyOverrides?: unknown };
export function resolveBusinessProfile(input: BusinessProfileInput): SectorProfile {
  const key = input.sectorKey && input.sectorKey in sectorProfiles ? input.sectorKey as SectorKey : "construction";
  const selected = sectorProfiles[key];
  const overrides = isTerminology(input.terminologyOverrides) ? input.terminologyOverrides : {};
  return { ...selected, terminology: { ...selected.terminology, ...overrides } };
}
function isTerminology(value: unknown): value is Partial<SectorTerminology> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
