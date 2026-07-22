import { resolveBusinessProfile, type BusinessProfileInput } from "./resolve-profile";
export function businessTerms(company: BusinessProfileInput) { return resolveBusinessProfile(company).terminology; }
