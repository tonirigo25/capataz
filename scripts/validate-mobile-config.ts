import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveMobileConfig } from "../lib/mobile-config";

const startedAt = Date.now();
const release = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://capataz.app" });
assert.equal(release.cleartext, false);
assert.equal(release.allowMixedContent, false);
assert.equal(release.serverUrl, "https://capataz.app");

const staging = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "staging", CAPATAZ_MOBILE_SERVER_URL: "https://staging.capataz.app" });
assert.equal(staging.cleartext, false);
assert.equal(staging.allowMixedContent, false);

const development = resolveMobileConfig({ CAPATAZ_MOBILE_MODE: "development", CAPATAZ_MOBILE_SERVER_URL: "http://10.0.2.2:3000" });
assert.equal(development.cleartext, true);
assert.equal(development.allowMixedContent, false);

for (const environment of [
  { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "http://capataz.app" },
  { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://localhost:3000" },
  { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://192.168.1.10" },
  { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://staging.capataz.app" },
  { CAPATAZ_MOBILE_MODE: "staging", CAPATAZ_MOBILE_SERVER_URL: "http://staging.capataz.app" },
  { CAPATAZ_MOBILE_MODE: "development", CAPATAZ_MOBILE_SERVER_URL: "https://example.com" },
  { CAPATAZ_MOBILE_MODE: "unknown", CAPATAZ_MOBILE_SERVER_URL: "https://capataz.app" },
  { CAPATAZ_MOBILE_MODE: "development" },
  { CAPATAZ_MOBILE_MODE: "release", CAPATAZ_MOBILE_SERVER_URL: "https://user:secret@capataz.app" }
]) {
  assert.throws(() => resolveMobileConfig(environment));
}

const capacitor = readFileSync(new URL("../capacitor.config.ts", import.meta.url), "utf8");
const androidManifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const iosPlist = readFileSync(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8");
assert.match(capacitor, /resolveMobileConfig/);
assert.doesNotMatch(capacitor, /cleartext:\s*true/);
assert.doesNotMatch(capacitor, /allowMixedContent:\s*true/);
assert.doesNotMatch(androidManifest, /usesCleartextTraffic\s*=\s*"true"/);
assert.doesNotMatch(iosPlist, /NSAllowsArbitraryLoads/);
assert.doesNotMatch(capacitor, /sk-|Bearer\s+|password\s*:/i);

console.log(JSON.stringify({ ok: true, tests: 22, elapsedMs: Date.now() - startedAt }));
