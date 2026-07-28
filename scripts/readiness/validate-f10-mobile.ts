import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { brandConfig } from "../../lib/config/brand";
import { resolveMobileConfig, resolveMobileDeepLink } from "../../lib/mobile-config";
import { androidAssetLinks, appleAppSiteAssociation, resolveMobileAssociationConfig } from "../../lib/mobile/association";
import { createMobileCrashEvent, sendSyntheticMobileCrash, type MobileCrashEvent } from "../../lib/mobile/crash-reporting";

const checks: string[] = [];
const source = (path: string) => readFileSync(path, "utf8");
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push(name); };

async function main() {
const release = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://app.example.com", CAPATAZ_MOBILE_APP_LINK_HOST: "app.example.com" });
check("release-https", release.serverUrl === "https://app.example.com" && !release.cleartext && !release.allowMixedContent);
check("release-client-identity", release.appId === brandConfig.mobile.appId && release.appName === brandConfig.mobile.appName && release.nativeCredentialsStored === false);
check("release-link-host", release.appLinkHost === "app.example.com" && release.authReturnUrl === "orqena://auth/callback");
const staging = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "staging", CAPATAZ_MOBILE_SERVER_URL: "https://mobile-preview.example.com" });
check("staging-separated", staging.mode === "staging" && !staging.cleartext);
const development = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "development", CAPATAZ_MOBILE_SERVER_URL: "http://10.0.2.2:3000" });
check("development-private-http", development.cleartext && development.mode === "development");
for (const [name, env] of Object.entries({
  "release-http": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "http://app.example.com" },
  "release-localhost": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://localhost:3000" },
  "release-private": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://192.168.1.5" },
  "release-staging": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://staging.example.com" },
  "release-credentials": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://user:pass@app.example.com" },
  "host-mismatch": { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://app.example.com", CAPATAZ_MOBILE_APP_LINK_HOST: "other.example.com" },
  "development-public": { CAPATAZ_MOBILE_MODE: "development", CAPATAZ_MOBILE_SERVER_URL: "https://app.example.com" },
})) {
  assert.throws(() => resolveMobileConfig(env), name);
  checks.push(name);
}

check("universal-auth-link", resolveMobileDeepLink("https://app.example.com/auth/mobile/callback?state=synthetic", release).source === "universal-link");
check("custom-auth-link", resolveMobileDeepLink("orqena://auth/callback?state=synthetic", release).pathname === "/auth/mobile/callback");
check("shared-open-link", resolveMobileDeepLink("https://app.example.com/open/work/synthetic", release).pathname === "/open/work/synthetic");
for (const input of ["https://other.example.com/open/x", "https://app.example.com/admin", "javascript:alert(1)"]) {
  assert.throws(() => resolveMobileDeepLink(input, release), /MOBILE_DEEP_LINK_NOT_ALLOWED/);
  checks.push(`deep-link-rejected-${checks.length}`);
}

const fingerprint = Array.from({ length: 32 }, () => "AA").join(":");
const association = resolveMobileAssociationConfig({ CAPATAZ_MOBILE_APP_LINK_HOST: "app.example.com", CAPATAZ_MOBILE_ANDROID_SHA256_CERT_FINGERPRINTS: fingerprint, CAPATAZ_MOBILE_IOS_TEAM_ID: "ABCDE12345" });
check("association-configured", association?.host === "app.example.com");
const androidLinks = association ? androidAssetLinks(association) : null;
check("android-association-minimal", androidLinks?.[0].target.package_name === "com.orqena.app" && androidLinks[0].target.sha256_cert_fingerprints.length === 1);
const appleLinks = association ? appleAppSiteAssociation(association) : null;
check("apple-association-minimal", appleLinks?.applinks.details[0].appID === "ABCDE12345.com.orqena.app" && appleLinks.applinks.details[0].paths.length === 2);
check("associations-fail-closed", resolveMobileAssociationConfig({}) === null);
assert.throws(() => resolveMobileAssociationConfig({ CAPATAZ_MOBILE_APP_LINK_HOST: "host.invalid" }), /HOST_INVALID/);
checks.push("invalid-association-host-rejected");

const captured: MobileCrashEvent[] = [];
const receipt = await sendSyntheticMobileCrash({ send: async (event) => { captured.push(event); return { accepted: true, reference: "synthetic-crash-receipt" }; } }, { eventId: "mobile:synthetic:001", occurredAt: new Date("2026-07-26T00:00:00.000Z"), platform: "android", environment: "staging", releaseSha: "a".repeat(40), code: "SYNTHETIC_CRASH" });
check("synthetic-crash-arrived", receipt.accepted && captured.length === 1 && captured[0].synthetic);
check("crash-minimized", Object.keys(captured[0]).sort().join(",") === ["code", "environment", "eventId", "fingerprint", "occurredAt", "platform", "releaseSha", "synthetic", "version"].sort().join(","));
check("crash-fingerprint-deterministic", captured[0].fingerprint === createMobileCrashEvent({ eventId: "mobile:synthetic:002", occurredAt: new Date(), platform: "android", environment: "staging", releaseSha: "a".repeat(40), code: "SYNTHETIC_CRASH", synthetic: true }).fingerprint);
assert.throws(() => createMobileCrashEvent({ eventId: "mobile:synthetic:003", occurredAt: new Date(), platform: "ios", environment: "release", releaseSha: "b".repeat(40), code: "SYNTHETIC_CRASH", email: "synthetic@example.invalid" }), /FIELD_FORBIDDEN:email/);
checks.push("crash-pii-rejected");

const manifest = source("android/app/src/main/AndroidManifest.xml");
check("android-only-internet-permission", (manifest.match(/<uses-permission/g) ?? []).length === 1 && manifest.includes("android.permission.INTERNET"));
check("android-app-links", manifest.includes('android:autoVerify="true"') && manifest.includes("${mobileAppLinkHost}") && manifest.includes("/auth/mobile/callback"));
const paths = source("android/app/src/main/res/xml/file_paths.xml");
check("android-app-scoped-cache", paths.includes('cache-path name="shared_downloads" path="downloads/"') && !paths.includes("external-path"));
const gradle = source("android/app/build.gradle");
check("android-release-signing-fails-closed", gradle.includes("releaseSigningComplete") && gradle.includes("Release signing is incomplete"));

const plist = source("ios/App/App/Info.plist");
const entitlements = source("ios/App/App/App.entitlements");
const xcode = source("ios/App/App.xcodeproj/project.pbxproj");
check("ios-custom-scheme", plist.includes("CFBundleURLSchemes") && plist.includes("$(MOBILE_URL_SCHEME)"));
check("ios-universal-links", entitlements.includes("com.apple.developer.associated-domains") && entitlements.includes("$(MOBILE_APP_LINK_HOST)"));
check("ios-release-manual-signing", xcode.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements") && xcode.includes("CODE_SIGN_STYLE = Manual"));
check("ios-no-unnecessary-permission-prompts", !/NS(?:Camera|Microphone|PhotoLibrary|Location|Contacts).*UsageDescription/.test(plist));

const privacy = JSON.parse(source("contracts/mobile/v1/store-privacy.json")) as { status: string; tracking: boolean; advertising: boolean; saleOfData: boolean; nativeCredentialsStored: boolean; categories: unknown[]; permissionPolicy: { androidManifest: string[] } };
check("store-privacy-prepared-not-submitted", privacy.status === "PREPARED_NOT_SUBMITTED" && privacy.categories.length === 6);
check("store-no-tracking-ads-sale", !privacy.tracking && !privacy.advertising && !privacy.saleOfData);
check("store-native-credentials-false", !privacy.nativeCredentialsStored && privacy.permissionPolicy.androidManifest.join(",") === "INTERNET");
const distribution = JSON.parse(source("contracts/mobile/v1/distribution.json")) as { storeState: string; publicationClaim: boolean; releaseRejectsLocalAndStagingHosts: boolean };
check("publication-not-claimed", distribution.storeState === "NOT_SUBMITTED" && !distribution.publicationClaim);
check("distribution-release-fail-closed", distribution.releaseRejectsLocalAndStagingHosts);

for (const file of ["docs/mobile/ARCHITECTURE_AND_STORE_READINESS.md", "docs/mobile/STORE_LISTING_DRAFT.md", "docs/runbooks/MOBILE_SIGNING_AND_DISTRIBUTION.md"]) check(`${file}-present`, source(file).length > 500);
const packageJson = source("package.json");
for (const script of ["mobile:validate", "guard-release-build.mjs android", "guard-release-build.mjs ios", "mobile:artifact-manifest"]) check(`package-${script}`, packageJson.includes(script));
const guard = spawnSync(process.execPath, ["scripts/mobile/guard-release-build.mjs", "android"], { cwd: process.cwd(), env: { NODE_ENV: "test" }, encoding: "utf8", windowsHide: true });
check("release-guard-rejects-missing-signing", guard.status !== 0 && /MOBILE_RELEASE_GATE_INCOMPLETE/.test(`${guard.stderr}${guard.stdout}`));
check("mobile-scripts-do-not-print-secret-values", source("scripts/mobile/guard-release-build.mjs").includes("secretValuesPrinted: false") && !source("scripts/mobile/guard-release-build.mjs").includes("console.log(process.env"));

console.log(JSON.stringify({ ok: true, phase: "F10", checks: checks.length, names: checks, syntheticCrashCalls: 1, externalCalls: 0, signedArtifactsBuilt: 0, storeSubmissions: 0, productionWrites: 0, stagingWrites: 0 }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
