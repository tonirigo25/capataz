const target = process.argv[2];
if (!new Set(["android", "ios"]).has(target)) throw new Error("MOBILE_BUILD_TARGET_REQUIRED");

const requiredCommon = ["CAPATAZ_MOBILE_SERVER_URL", "CAPATAZ_MOBILE_APP_LINK_HOST", "MOBILE_RELEASE_SHA", "MOBILE_VERSION", "MOBILE_BUILD_NUMBER"];
const requiredAndroid = ["CAPATAZ_ANDROID_KEYSTORE_PATH", "CAPATAZ_ANDROID_KEYSTORE_PASSWORD", "CAPATAZ_ANDROID_KEY_ALIAS", "CAPATAZ_ANDROID_KEY_PASSWORD", "CAPATAZ_MOBILE_ANDROID_SHA256_CERT_FINGERPRINTS"];
const requiredIos = ["CAPATAZ_MOBILE_IOS_TEAM_ID", "CAPATAZ_IOS_SIGNING_IDENTITY", "CAPATAZ_IOS_PROVISIONING_PROFILE"];
const names = [...requiredCommon, ...(target === "android" ? requiredAndroid : requiredIos)];
const missing = names.filter((name) => !process.env[name]?.trim());
if (process.env.CAPATAZ_MOBILE_MODE !== "release") missing.push("CAPATAZ_MOBILE_MODE=release");
if (missing.length) throw new Error(`MOBILE_RELEASE_GATE_INCOMPLETE:${missing.join(",")}`);

const server = new URL(process.env.CAPATAZ_MOBILE_SERVER_URL);
const host = process.env.CAPATAZ_MOBILE_APP_LINK_HOST.toLowerCase();
if (server.protocol !== "https:" || server.hostname.toLowerCase() !== host || /localhost|127\.0\.0\.1|^10\.|^192\.168\.|\.staging\./i.test(server.hostname)) throw new Error("MOBILE_RELEASE_BACKEND_INVALID");
if (!/^[0-9a-f]{40}$/i.test(process.env.MOBILE_RELEASE_SHA)) throw new Error("MOBILE_RELEASE_SHA_INVALID");
if (!/^\d+\.\d+\.\d+$/.test(process.env.MOBILE_VERSION)) throw new Error("MOBILE_VERSION_INVALID");
if (!/^[1-9]\d*$/.test(process.env.MOBILE_BUILD_NUMBER)) throw new Error("MOBILE_BUILD_NUMBER_INVALID");
if (target === "ios" && process.platform !== "darwin") throw new Error("IOS_ARCHIVE_REQUIRES_MACOS");

console.log(JSON.stringify({ ok: true, target, configuredVariables: names, secretValuesPrinted: false }));
