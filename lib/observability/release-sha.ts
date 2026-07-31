const RELEASE_SHA_KEYS = [
  "APP_RELEASE_SHA",
  "RAILWAY_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "NEXT_PUBLIC_RELEASE_SHA",
] as const;

export function resolveReleaseSha(env: NodeJS.ProcessEnv = process.env): string {
  for (const key of RELEASE_SHA_KEYS) {
    const candidate = env[key]?.trim();
    if (candidate) return candidate;
  }
  return "unknown";
}
