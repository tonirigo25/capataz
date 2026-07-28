type MobileAssociationEnvironment = Record<string, string | undefined>;

const androidFingerprint = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const safeHost = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function resolveMobileAssociationConfig(env: MobileAssociationEnvironment) {
  const host = env.CAPATAZ_MOBILE_APP_LINK_HOST?.trim().toLowerCase();
  if (!host) return null;
  if (!safeHost.test(host) || /^(?:localhost|.+\.invalid)$/.test(host)) throw new Error("MOBILE_ASSOCIATION_HOST_INVALID");
  const androidPackage = env.CAPATAZ_MOBILE_ANDROID_PACKAGE?.trim() || "com.orqena.app";
  const fingerprints = (env.CAPATAZ_MOBILE_ANDROID_SHA256_CERT_FINGERPRINTS ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  const iosTeamId = env.CAPATAZ_MOBILE_IOS_TEAM_ID?.trim().toUpperCase();
  const iosBundleId = env.CAPATAZ_MOBILE_IOS_BUNDLE_ID?.trim() || "com.orqena.app";
  if (!/^[A-Za-z][A-Za-z0-9.]{2,100}$/.test(androidPackage) || !/^[A-Za-z][A-Za-z0-9.]{2,100}$/.test(iosBundleId)) throw new Error("MOBILE_ASSOCIATION_APP_ID_INVALID");
  if (fingerprints.some((value) => !androidFingerprint.test(value))) throw new Error("MOBILE_ANDROID_FINGERPRINT_INVALID");
  if (iosTeamId && !/^[A-Z0-9]{10}$/.test(iosTeamId)) throw new Error("MOBILE_IOS_TEAM_ID_INVALID");
  return { host, androidPackage, fingerprints, iosTeamId: iosTeamId || null, iosBundleId };
}

export function androidAssetLinks(config: NonNullable<ReturnType<typeof resolveMobileAssociationConfig>>) {
  if (!config.fingerprints.length) return null;
  return [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: config.androidPackage, sha256_cert_fingerprints: config.fingerprints } }];
}

export function appleAppSiteAssociation(config: NonNullable<ReturnType<typeof resolveMobileAssociationConfig>>) {
  if (!config.iosTeamId) return null;
  return { applinks: { apps: [], details: [{ appID: `${config.iosTeamId}.${config.iosBundleId}`, paths: ["/auth/mobile/callback", "/open/*"] }] } };
}
