import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function walk(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, result);
    else if (entry.name === "route.ts") result.push(absolute);
  }
  return result;
}

function normalize(value) {
  return value.replaceAll("\\", "/");
}

for (const absolute of walk(path.join(root, "app"))) {
  let source = fs.readFileSync(absolute, "utf8");
  if (source.includes("@/lib/platform/request-boundary")) continue;
  const relative = normalize(path.relative(root, absolute));
  const route = `/${relative.replace(/^app\//u, "").replace(/\/route\.ts$/u, "").replace(/^\(app\)\//u, "")}`;
  const wrapper = route.startsWith("/api/internal/automations") || route.startsWith("/api/internal/proactive-evaluate")
    ? "internalJobRequestContext"
    : route.startsWith("/api/internal/") ? "internalRequestContext" : "publicRequestContext";
  const file = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const replacements = [];
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(statement.name.text)) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) || !statement.body) continue;
    const parameters = statement.parameters.map((parameter) => parameter.getText(file)).join(", ");
    const first = statement.parameters[0]?.name;
    const requestExpression = first && ts.isIdentifier(first) ? first.text : "undefined";
    const body = source.slice(statement.body.getStart(file) + 1, statement.body.end - 1);
    const operation = `${statement.name.text} ${route}`;
    const replacement = `export async function ${statement.name.text}(${parameters}) {\n  return ${wrapper}("${operation}", ${requestExpression}, async () => {${body}\n  });\n}`;
    replacements.push({ start: statement.getStart(file), end: statement.end, text: replacement });
  }
  if (!replacements.length) throw new Error(`No route handler found in ${relative}`);
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) source = `${source.slice(0, replacement.start)}${replacement.text}${source.slice(replacement.end)}`;
  source = `import { ${wrapper} } from "@/lib/platform/request-boundary";\n${source}`;
  fs.writeFileSync(absolute, source, "utf8");
  process.stdout.write(`${relative}: ${wrapper}\n`);
}
