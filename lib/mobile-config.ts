import { brandConfig } from "./config/brand";

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

const safeMobilePaths = ["/auth/mobile/callback", "/open"] as const;

function requiredIdentifier(value: string | undefined, fallback: string, name: string) {
  const resolved = value?.trim() || fallback;
  if (!/^[A-Za-z][A-Za-z0-9.-]{2,100}$/.test(resolved)) throw new Error(`${name} is invalid`);
  return resolved;
}

function requiredScheme(value: string | undefined) {
  const resolved = value?.trim() || brandConfig.mobile.urlScheme;
  if (!/^[a-z][a-z0-9+.-]{1,30}$/.test(resolved)) throw new Error("CAPATAZ_MOBILE_URL_SCHEME is invalid");
  return resolved;
}

export function resolveMobileConfig(env: MobileEnvironment) {
  const rawMode = env.CAPATAZ_MOBILE_MODE || "release";
  if (!(["development", "staging", "release"] as string[]).includes(rawMode)) {
    throw new Error("CAPATAZ_MOBILE_MODE must be development, staging or release");
  }
  const mode = rawMode as MobileMode;
  const rawUrl = env.CAPATAZ_MOBILE_SERVER_URL || env.NEXT_PUBLIC_WEB_BASE_URL || "";
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

  const appId = requiredIdentifier(env.CAPATAZ_MOBILE_APP_ID, brandConfig.mobile.appId, "CAPATAZ_MOBILE_APP_ID");
  const appName = env.CAPATAZ_MOBILE_APP_NAME?.trim() || brandConfig.mobile.appName;
  if (appName.length < 2 || appName.length > 30) throw new Error("CAPATAZ_MOBILE_APP_NAME is invalid");
  const urlScheme = requiredScheme(env.CAPATAZ_MOBILE_URL_SCHEME);
  const appLinkHost = (env.CAPATAZ_MOBILE_APP_LINK_HOST?.trim() || url.hostname).toLowerCase();
  if (appLinkHost !== url.hostname.toLowerCase()) throw new Error("Mobile app-link host must match the configured backend host");

  return {
    mode,
    appId,
    appName,
    serverUrl: url.toString().replace(/\/$/, ""),
    appLinkHost,
    urlScheme,
    authReturnUrl: `${urlScheme}://auth/callback`,
    universalAuthReturnUrl: `https://${appLinkHost}/auth/mobile/callback`,
    cleartext: mode === "development" && url.protocol === "http:",
    allowMixedContent: false,
    allowedDeepLinkPaths: safeMobilePaths,
    nativeCredentialsStored: false,
  };
}

export function resolveMobileDeepLink(input: string, config: ReturnType<typeof resolveMobileConfig>) {
  const url = new URL(input);
  const isUniversal = url.protocol === "https:" && url.hostname.toLowerCase() === config.appLinkHost;
  const isCustom = url.protocol === `${config.urlScheme}:` && url.hostname === "auth";
  const pathname = isCustom ? `/auth/mobile${url.pathname}` : url.pathname;
  if ((!isUniversal && !isCustom) || !config.allowedDeepLinkPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    throw new Error("MOBILE_DEEP_LINK_NOT_ALLOWED");
  }
  return { pathname, search: url.search, source: isCustom ? "custom-scheme" as const : "universal-link" as const };
}
