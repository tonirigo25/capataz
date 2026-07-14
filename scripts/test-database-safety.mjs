const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertIsolatedTestDatabase(env = process.env) {
  if (env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true") {
    throw new Error("CAPATAZ_TEST_DATABASE_ISOLATED_MUST_BE_TRUE");
  }
  if (!env.DATABASE_URL) throw new Error("TEST_DATABASE_URL_MISSING");

  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("TEST_DATABASE_URL_INVALID");
  }

  if (/railway|rlwy/i.test(url.hostname)) throw new Error("RAILWAY_DATABASE_FORBIDDEN_FOR_TESTS");
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("NON_LOCAL_DATABASE_FORBIDDEN_FOR_TESTS");
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("POSTGRES_TEST_DATABASE_REQUIRED");

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^capataz_test(?:[_-].*)?$/i.test(databaseName)) {
    throw new Error("EXPLICIT_TEST_DATABASE_NAME_REQUIRED");
  }

  return { host: url.hostname, databaseName };
}
