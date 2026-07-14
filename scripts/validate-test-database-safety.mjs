import assert from "node:assert/strict";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const accepted = assertIsolatedTestDatabase({
  CAPATAZ_TEST_DATABASE_ISOLATED: "true",
  DATABASE_URL: "postgresql://tester:secret@127.0.0.1:55432/capataz_test_automation",
});
assert.equal(accepted.host, "127.0.0.1");
assert.equal(accepted.databaseName, "capataz_test_automation");

const rejected = [
  [{}, /CAPATAZ_TEST_DATABASE_ISOLATED_MUST_BE_TRUE/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "true" }, /TEST_DATABASE_URL_MISSING/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "false", DATABASE_URL: "postgresql://tester:secret@127.0.0.1/capataz_test" }, /CAPATAZ_TEST_DATABASE_ISOLATED_MUST_BE_TRUE/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "true", DATABASE_URL: "postgresql://tester:secret@reseau.proxy.rlwy.net:5432/railway" }, /RAILWAY_DATABASE_FORBIDDEN_FOR_TESTS/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "true", DATABASE_URL: "postgresql://tester:secret@postgres.railway.internal:5432/railway" }, /RAILWAY_DATABASE_FORBIDDEN_FOR_TESTS/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "true", DATABASE_URL: "postgresql://tester:secret@db.example.com:5432/capataz_test" }, /NON_LOCAL_DATABASE_FORBIDDEN_FOR_TESTS/],
  [{ CAPATAZ_TEST_DATABASE_ISOLATED: "true", DATABASE_URL: "postgresql://tester:secret@localhost:5432/railway" }, /EXPLICIT_TEST_DATABASE_NAME_REQUIRED/],
];

for (const [env, expected] of rejected) assert.throws(() => assertIsolatedTestDatabase(env), expected);

console.log("[test-database-safety] OK explicit opt-in, loopback host and isolated database name required");
