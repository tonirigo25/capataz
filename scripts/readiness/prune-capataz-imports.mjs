import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const directory = path.join(process.cwd(), "lib/orqena/application/capataz");
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

function usedIdentifiers(file) {
  const used = new Set();
  function inspect(node) {
    if (ts.isIdentifier(node)) used.add(node.text);
    ts.forEachChild(node, inspect);
  }
  for (const statement of file.statements) if (!ts.isImportDeclaration(statement)) inspect(statement);
  return used;
}

function filteredImport(statement, used) {
  const clause = statement.importClause;
  if (!clause) return statement;
  const defaultName = clause.name && used.has(clause.name.text) ? clause.name : undefined;
  let bindings;
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    if (used.has(clause.namedBindings.name.text)) bindings = clause.namedBindings;
  } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    const elements = clause.namedBindings.elements.filter((element) => used.has(element.name.text));
    if (elements.length) bindings = ts.factory.updateNamedImports(clause.namedBindings, elements);
  }
  if (!defaultName && !bindings) return null;
  return ts.factory.updateImportDeclaration(
    statement,
    statement.modifiers,
    ts.factory.updateImportClause(clause, clause.isTypeOnly, defaultName, bindings),
    statement.moduleSpecifier,
    statement.attributes,
  );
}

for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
  const absolute = path.join(directory, entry.name);
  const source = fs.readFileSync(absolute, "utf8");
  const file = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const used = usedIdentifiers(file);
  const replacements = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const filtered = filteredImport(statement, used);
    replacements.push({ start: statement.getFullStart(), end: statement.end, text: filtered ? `${printer.printNode(ts.EmitHint.Unspecified, filtered, file)}\n` : "" });
  }
  let output = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  output = output.replace(/^\s+/u, "");
  fs.writeFileSync(absolute, output, "utf8");
  process.stdout.write(`${entry.name}: imports pruned\n`);
}
