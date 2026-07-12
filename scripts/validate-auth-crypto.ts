import assert from "node:assert/strict";
import { createOpaqueToken, hashPassword, hashToken, normalizeEmail, validatePassword, verifyPassword } from "../lib/auth/crypto";

async function main() {
  assert.equal(normalizeEmail("  Persona@Ejemplo.ES "), "persona@ejemplo.es");
  assert.ok(validatePassword("corta").length > 0);
  assert.deepEqual(validatePassword("Una-clave-segura-2026"), []);
  const encoded = await hashPassword("Una-clave-segura-2026");
  assert.ok(!encoded.includes("Una-clave-segura-2026"));
  assert.equal(await verifyPassword("Una-clave-segura-2026", encoded), true);
  assert.equal(await verifyPassword("Otra-clave-segura-2026", encoded), false);
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first, second);
  assert.notEqual(hashToken(first), first);
  assert.equal(hashToken(first), hashToken(first));
  console.log("[auth-crypto] password and token invariants passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
