export type MobileMode = "development" | "staging" | "release";

type MobileEnvironment = Record<string, string | undefined>;

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" || isPrivateIpv4(hostname);
}

export function resolveMobileConfig(env: MobileEnvironment) {
  const rawMode = env.CAPATAZ_MOBILE_MODE || "release";
  if (!(["development", "staging", "release"] as string[]).includes(rawMode)) {
    throw new Error("CAPATAZ_MOBILE_MODE must be development, staging or release");
  }
  const mode = rawMode as MobileMode;
  const rawUrl = env.CAPATAZ_MOBILE_SERVER_URL || env.NEXT_PUBLIC_WEB_BASE_URL || (mode === "release" ? "https://capataz.app" : "");
  if (!rawUrl) throw new Error(`CAPATAZ_MOBILE_SERVER_URL is required in ${mode} mode`);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("CAPATAZ_MOBILE_SERVER_URL must be an absolute URL");
  }
  if (url.username || url.password) throw new Error("Mobile server URL must not contain credentials");

  if (mode === "development") {
    if (!isLocalHost(url.hostname)) throw new Error("Development mobile URL must use localhost or a private network address");
    if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new Error("Development mobile URL must use HTTP or HTTPS");
  } else {
    if (url.protocol !== "https:") throw new Error(`${mode} mobile URL must use HTTPS`);
    if (isLocalHost(url.hostname)) throw new Error(`${mode} mobile URL must not use a local or private address`);
    if (mode === "release" && /(^|\.)staging\./i.test(url.hostname)) throw new Error("Release mobile URL must not point to staging");
  }

  return {
    mode,
    serverUrl: url.toString().replace(/\/$/, ""),
    cleartext: mode === "development" && url.protocol === "http:",
    allowMixedContent: false
  };
}
