export const APP_ENVIRONMENTS = ["development", "test", "staging", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function readAppEnvironment(
  value = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV,
): AppEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "production" || normalized === "staging" || normalized === "test") {
    return normalized;
  }
  return "development";
}

export function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value?.trim().toLowerCase() === "true") return true;
  if (value?.trim().toLowerCase() === "false") return false;
  return fallback;
}

export function readCsv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}
