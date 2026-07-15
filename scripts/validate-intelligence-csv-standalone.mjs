import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);

const pgPort = Number(process.env.CAPATAZ_CSV_STANDALONE_POSTGRES_PORT ?? 55491);
const appPort = Number(process.env.CAPATAZ_CSV_STANDALONE_APP_PORT ?? 3017);
const password = randomBytes(24).toString("hex");
const databaseName = "capataz_test_csv_export";
const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${pgPort}/${databaseName}?schema=public`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  CAPATAZ_TEST_DATABASE_ISOLATED: "true",
  APP_ENV: "test",
  NEXT_PUBLIC_APP_ENV: "test",
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: String(appPort)
};
assertIsolatedTestDatabase(env);

const pg = new EmbeddedPostgres({
  databaseDir: join(root, `csv-export-${Date.now()}`),
  user: "postgres",
  password,
  port: pgPort,
  persistent: true
});

let child;

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function expect(condition, message, details) {
  if (!condition) {
    console.error(message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}

async function waitForServer(baseUrl, output) {
  const deadline = Date.now() + 90_000;
  let lastError;
  let lastResponse;
  while (Date.now() < deadline) {
    try {
      const response = await httpRequest(`${baseUrl}/api/status`);
      if (response.status) return;
      lastResponse = { status: response.status, contentType: response.headers["content-type"], body: response.text.slice(0, 300) };
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`SERVER_NOT_READY:${lastError?.message ?? "timeout"} ${JSON.stringify(lastResponse)}\n${output().slice(-2000)}`);
}

function httpRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers, timeout: 5_000 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        text: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", reject);
  });
}

async function seed() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86_400_000);
  const tenants = {};
  for (const key of ["A", "B"]) {
    const token = randomBytes(32).toString("base64url");
    const user = await prisma.user.create({
      data: {
        email: `csv-${key.toLowerCase()}@example.invalid`,
        emailNormalized: `csv-${key.toLowerCase()}@example.invalid`,
        passwordHash: "scrypt-v1$unused$unused",
        displayName: `Usuario CSV ${key}`,
        status: "active",
        emailVerifiedAt: now
      }
    });
    const company = await prisma.company.create({
      data: {
        slug: `csv-${key.toLowerCase()}-${Date.now()}`,
        nombreComercial: `Empresa CSV ${key}`,
        razonSocial: `Empresa CSV ${key} SL`,
        taxId: `CSV-${key}`,
        email: `empresa-csv-${key.toLowerCase()}@example.invalid`
      }
    });
    await prisma.companyMembership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER", status: "active", acceptedAt: now, joinedAt: now } });
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt, userAgent: "csv-standalone-test" } });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        nombre: `Cliente CSV ${key}`,
        telefono: "600000000",
        email: `cliente-csv-${key.toLowerCase()}@example.invalid`,
        direccion: `Calle CSV ${key}`,
        tipo: "empresa",
        origen: "standalone-test"
      }
    });
    const work = await prisma.work.create({
      data: {
        companyId: company.id,
        clienteId: client.id,
        titulo: `Obra CSV ${key}`,
        direccion: `Obra Dirección ${key}`,
        tipoTrabajo: "reforma",
        estado: "en_curso",
        prioridad: "media",
        presupuestoAprobado: 1000,
        costePrevisto: 100,
        gastoReal: 0,
        margenEstimado: 900
      }
    });
    await prisma.invoice.create({
      data: {
        companyId: company.id,
        clienteId: client.id,
        obraId: work.id,
        numero: `FCSV-${key}-001`,
        concepto: `Factura CSV ${key}`,
        importeBase: 1000,
        iva: 210,
        total: 1210,
        pagado: 0,
        pendiente: 1210,
        fechaEmision: now,
        fechaVencimiento: new Date(now.getTime() + 7 * 86_400_000),
        estado: "emitida"
      }
    });
    tenants[key] = { token, companyId: company.id, clientName: client.nombre, workTitle: work.titulo, invoiceConcept: `Factura CSV ${key}` };
  }
  await prisma.$disconnect();
  return tenants;
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(databaseName);
  execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "pipe", shell: true });
  const tenants = await seed();

  child = spawn(process.execPath, ["scripts/start-standalone.mjs"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { childOutput += chunk.toString(); });

  const baseUrl = `http://localhost:${appPort}`;
  await waitForServer(baseUrl, () => childOutput);
  const cookieA = `capataz_session=${tenants.A.token}`;

  const noSession = await httpRequest(`${baseUrl}/inteligencia/export?tipo=works`);
  expect(noSession.status !== 200 || !String(noSession.headers["content-type"] ?? "").startsWith("text/html"), "[intelligence-csv-standalone] unauthenticated export must not be HTML 200", { status: noSession.status, headers: noSession.headers });

  for (const [tipo, ownMarker, otherMarker] of [
    ["works", tenants.A.workTitle, tenants.B.workTitle],
    ["pending-invoices", tenants.A.invoiceConcept, tenants.B.invoiceConcept]
  ]) {
    const response = await httpRequest(`${baseUrl}/inteligencia/export?tipo=${tipo}`, { cookie: cookieA });
    const text = response.text;
    expect(response.status === 200, `[intelligence-csv-standalone] ${tipo} should return 200`, response.status);
    expect(String(response.headers["content-type"] ?? "").startsWith("text/csv"), `[intelligence-csv-standalone] ${tipo} should return CSV`, response.headers);
    expect(String(response.headers["content-disposition"] ?? "").includes("attachment"), `[intelligence-csv-standalone] ${tipo} should be attachment`, response.headers);
    expect(response.headers["cache-control"] === "private, no-store", `[intelligence-csv-standalone] ${tipo} should be private/no-store`, response.headers);
    expect(response.headers["x-content-type-options"] === "nosniff", `[intelligence-csv-standalone] ${tipo} should set nosniff`, response.headers);
    expect(text.includes(ownMarker), `[intelligence-csv-standalone] ${tipo} should include tenant A data`, text);
    expect(!text.includes(otherMarker), `[intelligence-csv-standalone] ${tipo} should not include tenant B data`, text);
    expect(!text.includes(tenants.A.companyId), `[intelligence-csv-standalone] ${tipo} should not expose companyId`, text);
  }

  const invalid = await httpRequest(`${baseUrl}/inteligencia/export?tipo=unknown`, { cookie: cookieA });
  const invalidText = invalid.text;
  expect(invalid.status === 400, "[intelligence-csv-standalone] unknown type should return 400", invalid.status);
  expect(!/Prisma|stack|DATABASE_URL|companyId/i.test(invalidText), "[intelligence-csv-standalone] unknown type should not leak internals", invalidText);

  expect(!/migrate deploy|db:deploy/i.test(childOutput), "[intelligence-csv-standalone] startup must not execute migrations", childOutput);
  console.log(JSON.stringify({ ok: true, isolated: true, host: "127.0.0.1", database: databaseName, appPort, checked: ["works", "pending-invoices"] }));
} finally {
  child?.kill();
  await pg.stop().catch(() => {});
}
