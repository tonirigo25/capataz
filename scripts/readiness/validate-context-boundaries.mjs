import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const failures = [];
const fixtureIndex = process.argv.indexOf("--fixture");
const fixture = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : null;
const wrappers = new Set(["publicRequestContext", "internalRequestContext", "internalJobRequestContext", "webhookRequestContext"]);

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function walk(directory, fileName, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, fileName, result);
    else if (entry.name === fileName) result.push(absolute);
  }
  return result;
}

function inspectRoute(fileName) {
  const source = fs.readFileSync(fileName, "utf8");
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relative = normalize(path.relative(root, fileName));
  const methods = [];
  const calls = new Set();
  function inspect(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && wrappers.has(node.expression.text)) calls.add(node.expression.text);
    ts.forEachChild(node, inspect);
  }
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(statement.name.text) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) methods.push(statement.name.text);
  }
  inspect(file);
  if (!methods.length) failures.push(`${relative}: route has no exported handler`);
  if (!calls.size) failures.push(`${relative}: route handler lacks canonical request context`);
  return { relative, methods, calls: [...calls] };
}

if (fixture) {
  inspectRoute(path.resolve(root, fixture));
} else {
  const routes = walk(path.join(root, "app"), "route.ts").map(inspectRoute);
  if (routes.length !== 47) failures.push(`expected 47 routes, found ${routes.length}`);
  const alertsExport = routes.find((route) => route.relative === "app/(app)/alertas/export/route.ts");
  if (!alertsExport) {
    failures.push("app/(app)/alertas/export/route.ts: authenticated tenant export route missing");
  } else {
    const source = fs.readFileSync(path.join(root, alertsExport.relative), "utf8");
    if (!alertsExport.methods.includes("GET")) failures.push(`${alertsExport.relative}: GET handler missing`);
    for (const token of [
      'requireCapability("reports.export")',
      'resolveAuthorization(auth, "orqena.execute")',
      "companyId: auth.companyId",
      "filterBusinessSignalsForAccess",
      '"cache-control": "private, no-store"'
    ]) if (!source.includes(token)) failures.push(`${alertsExport.relative}: tenant export boundary missing ${token}`);
  }
  const suppliersExport = routes.find((route) => route.relative === "app/(app)/proveedores/export/route.ts");
  if (!suppliersExport) {
    failures.push("app/(app)/proveedores/export/route.ts: authenticated tenant export route missing");
  } else {
    const source = fs.readFileSync(path.join(root, suppliersExport.relative), "utf8");
    if (!suppliersExport.methods.includes("GET")) failures.push(`${suppliersExport.relative}: GET handler missing`);
    for (const token of [
      'requireCapability("reports.export")',
      'resolveAuthorization(auth, "purchases.suppliers.view")',
      "auth.companyId",
      '"cache-control": "private, no-store"',
      "csvCell"
    ]) if (!source.includes(token)) failures.push(`${suppliersExport.relative}: tenant export boundary missing ${token}`);
  }
  const subcontractorsExport = routes.find((route) => route.relative === "app/(app)/subcontratas/export/route.ts");
  if (!subcontractorsExport) {
    failures.push("app/(app)/subcontratas/export/route.ts: authenticated tenant export route missing");
  } else {
    const source = fs.readFileSync(path.join(root, subcontractorsExport.relative), "utf8");
    if (!subcontractorsExport.methods.includes("GET")) failures.push(`${subcontractorsExport.relative}: GET handler missing`);
    for (const token of [
      'requireCapability("reports.export")',
      'resolveAuthorization(auth, "purchases.suppliers.view")',
      "auth.companyId",
      '"cache-control": "private, no-store"',
      "csvCell"
    ]) if (!source.includes(token)) failures.push(`${subcontractorsExport.relative}: tenant export boundary missing ${token}`);
  }
  const supplierInvoicesExport = routes.find((route) => route.relative === "app/(app)/facturas-proveedor/export/route.ts");
  if (!supplierInvoicesExport) {
    failures.push("app/(app)/facturas-proveedor/export/route.ts: authenticated tenant export route missing");
  } else {
    const source = fs.readFileSync(path.join(root, supplierInvoicesExport.relative), "utf8");
    if (!supplierInvoicesExport.methods.includes("GET")) failures.push(`${supplierInvoicesExport.relative}: GET handler missing`);
    for (const token of [
      'requireCapability("reports.export")',
      'resolveAuthorization(auth, "purchases.received_invoices.view")',
      "auth.companyId",
      '"cache-control": "private, no-store"',
      "csvCell"
    ]) if (!source.includes(token)) failures.push(`${supplierInvoicesExport.relative}: tenant export boundary missing ${token}`);
  }
  const actions = walk(path.join(root, "app"), "actions.ts");
  if (actions.length !== 38) failures.push(`expected 38 action files, found ${actions.length}`);
  for (const action of actions) if (!fs.readFileSync(action, "utf8").includes("@/lib/platform/next-action-boundary")) failures.push(`${normalize(path.relative(root, action))}: action context boundary missing`);
  const requestContext = fs.readFileSync(path.join(root, "lib/platform/request-context.ts"), "utf8");
  for (const field of ["requestId", "correlationId", "causationId", "companyId", "membershipId", "actor", "jobId", "provider", "operation", "release", "environment"]) if (!requestContext.includes(`${field}`)) failures.push(`request context field missing: ${field}`);
  const boundary = fs.readFileSync(path.join(root, "lib/platform/request-boundary.ts"), "utf8");
  for (const wrapper of [...wrappers, "withJobContext", "withOutboxEventContext"]) if (!boundary.includes(`function ${wrapper}`)) failures.push(`context wrapper missing: ${wrapper}`);
  const logger = fs.readFileSync(path.join(root, "lib/observability/logger.ts"), "utf8");
  for (const field of ["actorIdHash", "membershipIdHash", "provider", "operation", "release", "environment"]) if (!logger.includes(`\"${field}\"`) && !logger.includes(`${field}:`)) failures.push(`safe log field missing: ${field}`);
  if (!logger.includes("SENSITIVE_KEY") || !logger.includes("SENSITIVE_VALUE")) failures.push("privacy log filters missing");
  const migration = fs.readFileSync(path.join(root, "prisma/migrations/20260726100000_readiness_f2_observability_context/migration.sql"), "utf8");
  for (const table of ["BusinessEvent", "AuditLog", "SecurityAuditEvent", "WebhookEvent"]) if (!migration.includes(`ALTER TABLE \"${table}\"`)) failures.push(`context migration table missing: ${table}`);
  const jobRoutes = routes.filter((route) => route.calls.includes("internalJobRequestContext"));
  if (jobRoutes.length !== 7) failures.push(`expected 7 job route boundaries, found ${jobRoutes.length}`);
}

const unique = [...new Set(failures)];
if (unique.length) {
  process.stderr.write(`${unique.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(fixture ? "fixture unexpectedly passed\n" : "context boundaries: PASS (38 actions, 47 routes, 7 jobs)\n");
