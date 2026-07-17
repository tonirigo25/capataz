import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as routeAccess from "../lib/route-access";

const startedAt = Date.now();
const publicPages = ["/", "/login", "/registro", "/recuperar-contrasena", "/verificar-email"];
const protectedPages = [
  "/hoy", "/clientes", "/obras/obra-1", "/proveedores", "/subcontratas",
  "/facturas-proveedor", "/facturas-subcontratas", "/gastos-materiales",
  "/capataz", "/buscar", "/alertas", "/recomendaciones", "/inteligencia",
  "/automatizaciones", "/tareas", "/seguimientos", "/demo-guiada"
];

for (const path of publicPages) assert.equal(routeAccess.isPublicPage(path), true, `${path} must be public`);
for (const path of protectedPages) assert.equal(routeAccess.isProtectedPage(path), true, `${path} must be protected`);
for (const path of ["/service-worker.js", "/manifest.webmanifest", "/offline.html", "/icons/capataz.svg", "/_next/static/chunk.js"]) {
  assert.equal(routeAccess.isPublicResource(path), true, `${path} must remain public`);
}
assert.equal(routeAccess.isPublicApi("/api/status"), true);
assert.equal(routeAccess.isPublicApi("/api/status/ai"), true);
assert.equal(routeAccess.isInternalApi("/api/internal/proactive-evaluate"), true);
assert.equal(routeAccess.isProtectedPage("/api/capataz/transcribe"), false);
assert.equal(routeAccess.safeReturnPath("/obras/123", "?tab=costes"), "/obras/123?tab=costes");
assert.equal(routeAccess.safeReturnPath("//external.example", ""), "/hoy");

const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
for (const path of ["/capataz", "/buscar", "/alertas", "/recomendaciones", "/inteligencia", "/automatizaciones", "/tareas", "/seguimientos", "/demo-guiada"]) {
  assert.equal(middleware.includes(`\"${path}\"`), false, `${path} must not be temporarily rewritten`);
}
assert.match(middleware, /SESSION_COOKIE_NAME/);
assert.match(middleware, /authenticated app layout validates/);

const transcribe = readFileSync(new URL("../app/api/capataz/transcribe/route.ts", import.meta.url), "utf8");
assert.match(transcribe, /getOptionalSession/);
assert.match(transcribe, /status: 401/);

console.log(JSON.stringify({ ok: true, tests: 37, elapsedMs: Date.now() - startedAt }));
