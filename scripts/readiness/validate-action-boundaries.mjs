import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const failures = [];
const fixtureIndex = process.argv.indexOf("--fixture");
const fixture = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : null;

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function walk(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, result);
    else if (entry.name === "actions.ts") result.push(absolute);
  }
  return result;
}

function parse(fileName) {
  return ts.createSourceFile(fileName, fs.readFileSync(fileName, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function exportedFunctions(file) {
  const names = [];
  for (const statement of file.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) names.push(statement.name.text);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
  }
  return names;
}

function inspectAction(fileName) {
  const file = parse(fileName);
  const relative = normalize(path.relative(root, fileName));
  let usesBoundary = false;
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const source = statement.moduleSpecifier.text;
    if (source === "@/lib/prisma" || source.endsWith("/prisma")) failures.push(`${relative}: direct Prisma import`);
    if (source === "@/lib/platform/next-action-boundary") usesBoundary = true;
  }
  function inspect(node) {
    if (ts.isIdentifier(node) && node.text === "prisma") failures.push(`${relative}: direct prisma reference`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["transaction", "create", "update", "delete", "upsert"].includes(node.expression.name.text)) {
      if (node.expression.expression.getText(file).includes("prisma")) failures.push(`${relative}: direct transaction or write`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(file);
  if (usesBoundary) {
    for (const statement of file.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const body = statement.body?.statements ?? [];
      if (body.length !== 1 || !ts.isReturnStatement(body[0]) || !body[0].expression || !body[0].expression.getText(file).startsWith("executeNextAction(")) {
        failures.push(`${relative}#${statement.name?.text}: migrated action is not a thin boundary`);
      }
    }
  }
  return { relative, exports: exportedFunctions(file) };
}

if (fixture) {
  inspectAction(path.resolve(root, fixture));
} else {
  const actions = walk(path.join(root, "app")).map(inspectAction);
  const classificationPath = path.join(root, "docs/readiness/evidence/f2/action-boundary-classification.json");
  const data = JSON.parse(fs.readFileSync(classificationPath, "utf8"));
  const expected = new Set(actions.flatMap((entry) => entry.exports.map((name) => `${entry.relative}#${name}`)));
  const actual = new Set(data.classifications.map((entry) => entry.id));
  for (const id of expected) if (!actual.has(id)) failures.push(`classification missing: ${id}`);
  for (const id of actual) if (!expected.has(id)) failures.push(`classification stale: ${id}`);
  for (const entry of data.classifications) {
    if (!entry.inputShape || !entry.authentication || !entry.authorization?.length || !["QUERY", "COMMAND"].includes(entry.operation) || !entry.service || !entry.postEffects) failures.push(`classification incomplete: ${entry.id}`);
    const service = path.join(root, entry.service);
    if (!fs.existsSync(service)) failures.push(`classification service missing: ${entry.id}`);
  }
  const serviceRoots = [path.join(root, "lib/application"), path.join(root, "lib/orqena/application")];
  for (const serviceRoot of serviceRoots) {
    if (!fs.existsSync(serviceRoot)) continue;
    const stack = [serviceRoot];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(absolute);
        else if (entry.name.endsWith(".ts")) {
          const source = fs.readFileSync(absolute, "utf8");
          if (/from\s+["']next\/(cache|navigation)["']/u.test(source)) failures.push(`${normalize(path.relative(root, absolute))}: application service imports Next UI primitive`);
          const relative = normalize(path.relative(root, absolute));
          const lines = source.split(/\r?\n/u).length - 1;
          if (relative.startsWith("lib/orqena/application/capataz/") && lines > 1_200) failures.push(`${relative}: hidden Capataz monolith (${lines} lines)`);
        }
      }
    }
  }
}

const uniqueFailures = [...new Set(failures)];
if (uniqueFailures.length) {
  process.stderr.write(`${uniqueFailures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(fixture ? "fixture unexpectedly passed\n" : "action boundaries: PASS\n");
