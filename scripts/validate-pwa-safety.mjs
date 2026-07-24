import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const startedAt = Date.now();
const sw = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
const offline = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../app/manifest.ts", import.meta.url), "utf8");
const register = readFileSync(new URL("../app/pwa-register.tsx", import.meta.url), "utf8");

assert.match(sw, /orqena-public-/);
assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
assert.match(sw, /LEGACY_CACHE_NAMES = new Set\(\["capataz-v1", "capataz-public-v2"\]\)/);
assert.match(sw, /request\.method !== "GET"/);
assert.match(sw, /request\.mode === "navigate"/);
assert.match(sw, /fetch\(request\)\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
assert.match(sw, /\/_next\/static\//);
assert.match(sw, /\/brand\//);
assert.match(sw, /no-store/);
assert.match(sw, /private/);
assert.match(sw, /set-cookie/);
assert.doesNotMatch(sw, /cache\.put\(event\.request/);
assert.doesNotMatch(sw, /"\/hoy"|"\/clientes"|"\/obras"|"\/dinero"|"\/capataz"/);
assert.doesNotMatch(sw, /keys\.filter\(\(key\) => key !== CACHE_NAME/);
assert.match(offline, /Orqena no guarda aquí clientes, (?:obras|trabajos), facturas/);
assert.doesNotMatch(offline, /localStorage|indexedDB|sessionStorage/);
assert.match(manifest, /start_url: "\/hoy"/);
assert.match(manifest, /scope: "\/"/);
assert.match(manifest, /id: "\/"/);
assert.match(manifest, /\/brand\/icon-192\.png/);
assert.match(manifest, /\/brand\/icon-512\.png/);
assert.match(manifest, /\/brand\/icon-maskable-512\.png/);
assert.equal([
  "../public/brand/icon-192.png",
  "../public/brand/icon-512.png",
  "../public/brand/icon-maskable-512.png",
].every((path) => existsSync(new URL(path, import.meta.url))), true);
assert.match(register, /service-worker\.js/);

console.log(JSON.stringify({ ok: true, tests: 24, elapsedMs: Date.now() - startedAt }));
