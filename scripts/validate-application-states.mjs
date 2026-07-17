import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const startedAt = Date.now();
const required = ["../app/loading.tsx", "../app/(app)/loading.tsx", "../app/(app)/error.tsx", "../app/global-error.tsx", "../app/not-found.tsx", "../public/offline.html"];
for (const relative of required) assert.equal(existsSync(new URL(relative, import.meta.url)), true, `${relative} must exist`);

const loading = readFileSync(new URL("../app/(app)/loading.tsx", import.meta.url), "utf8");
const error = readFileSync(new URL("../app/(app)/error.tsx", import.meta.url), "utf8");
const globalError = readFileSync(new URL("../app/global-error.tsx", import.meta.url), "utf8");
const notFound = readFileSync(new URL("../app/not-found.tsx", import.meta.url), "utf8");
assert.match(loading, /aria-live="polite"/);
assert.match(loading, /aria-busy="true"/);
assert.match(error, /Reintentar/);
assert.doesNotMatch(error, /console\.error\([^\n]*error\)/);
assert.match(globalError, /role="alert"/);
assert.match(globalError, /Reintentar/);
assert.match(notFound, /No encontramos esta página/);
assert.match(notFound, /Volver a Hoy/);

console.log(JSON.stringify({ ok: true, tests: 14, elapsedMs: Date.now() - startedAt }));
