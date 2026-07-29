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
  if (routes.length !== 40) failures.push(`expected 40 routes, found ${routes.length}`);
  const actions = walk(path.join(root, "app"), "actions.ts");
  if (actions.length !== 36) failures.push(`expected 36 action files, found ${actions.length}`);
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
process.stdout.write(fixture ? "fixture unexpectedly passed\n" : "context boundaries: PASS (36 actions, 40 routes, 7 jobs)\n");
