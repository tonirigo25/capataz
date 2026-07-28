import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const outputPath = path.join(root, "docs/readiness/evidence/f2/action-boundary-classification.json");
const queryActions = new Set([
  "app/(app)/capataz/actions.ts#loadChatConversations",
  "app/(app)/gastos-materiales/actions.ts#findDuplicateExpenseDocumentIds",
]);

const mutationNames = new Set([
  "create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany",
  "executeRaw", "executeRawUnsafe", "transaction",
]);

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
  const result = [];
  for (const statement of file.statements) {
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) result.push({ name: statement.name.text, node: statement, parameters: statement.parameters });
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
          result.push({ name: declaration.name.text, node: declaration.initializer, parameters: declaration.initializer.parameters });
        }
      }
    }
  }
  return result;
}

function localFunctions(file) {
  const result = new Map();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) result.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
          result.set(declaration.name.text, declaration.initializer);
        }
      }
    }
  }
  return result;
}

function serviceReference(actionFile, actionName) {
  for (const statement of actionFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.startsWith("@/lib/")) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const aliases = new Map();
    for (const element of bindings.elements) aliases.set(element.name.text, element.propertyName?.text ?? element.name.text);
    if (aliases.has(`${actionName}UseCase`)) {
      return { fileName: path.join(root, `${statement.moduleSpecifier.text.slice(2)}.ts`), aliases };
    }
  }
  return null;
}

function resolveUseCase(fileName, exportName, visited = new Set()) {
  const key = `${fileName}#${exportName}`;
  if (visited.has(key)) throw new Error(`Circular use-case export: ${key}`);
  visited.add(key);
  const file = parse(fileName);
  const direct = exportedFunctions(file).find((entry) => entry.name === exportName);
  if (direct) return { file, fileName, useCase: direct };
  for (const statement of file.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) continue;
      const importedName = element.propertyName?.text ?? element.name.text;
      const moduleText = statement.moduleSpecifier.text;
      const target = moduleText.startsWith("@/")
        ? path.join(root, `${moduleText.slice(2)}.ts`)
        : path.resolve(path.dirname(fileName), `${moduleText}.ts`);
      return resolveUseCase(target, importedName, visited);
    }
  }
  throw new Error(`Cannot resolve use case ${key}`);
}

function analyzeUseCase(file, rootNode) {
  const visited = new Set();
  const calls = new Set();
  const stringArguments = new Map();
  let writes = false;

  function internalImports(currentFile) {
    const result = new Map();
    for (const statement of currentFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith("@/lib/orqena/application/capataz/")) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const target = path.join(root, `${statement.moduleSpecifier.text.slice(2)}.ts`);
      for (const element of bindings.elements) result.set(element.name.text, { target, exportName: element.propertyName?.text ?? element.name.text });
    }
    return result;
  }

  function inspect(node, currentFile) {
    const functions = localFunctions(currentFile);
    const importedFunctions = internalImports(currentFile);
    if (ts.isCallExpression(node)) {
      let callName = "";
      if (ts.isIdentifier(node.expression)) callName = node.expression.text;
      else if (ts.isPropertyAccessExpression(node.expression)) callName = node.expression.name.text;
      if (callName) {
        calls.add(callName);
        const values = node.arguments.filter(ts.isStringLiteralLike).map((argument) => argument.text);
        if (values.length) stringArguments.set(callName, [...(stringArguments.get(callName) ?? []), ...values]);
        if (mutationNames.has(callName) || /^(create|save|update|delete|archive|restore|mark|register|invite|transfer|toggle|publish|run|execute|cancel|confirm|retry|change|set|complete|add|move|remove|void|upload|process|reprogram|accept|reject|dismiss|snooze)/u.test(callName)) writes = true;
        const localKey = `${currentFile.fileName}#${callName}`;
        if (functions.has(callName) && !visited.has(localKey)) {
          visited.add(localKey);
          inspect(functions.get(callName), currentFile);
        } else if (importedFunctions.has(callName) && !visited.has(localKey)) {
          visited.add(localKey);
          const imported = importedFunctions.get(callName);
          const resolved = resolveUseCase(imported.target, imported.exportName);
          inspect(resolved.useCase.node, resolved.file);
        }
      }
    }
    ts.forEachChild(node, (child) => inspect(child, currentFile));
  }
  inspect(rootNode, file);
  const authCalls = [...calls].filter((name) => /^(require|assert|resolveAuthorization|canExecute)/u.test(name));
  const authorization = authCalls.length
    ? authCalls.flatMap((name) => (stringArguments.get(name)?.length ? stringArguments.get(name).map((value) => `${name}:${value}`) : [name]))
    : ["delegated domain authorization"];
  return {
    writes,
    authorization: [...new Set(authorization)].sort(),
    postEffects: {
      revalidate: calls.has("revalidatePath"),
      redirect: calls.has("redirect"),
      audit: [...calls].some((name) => /audit|SecurityEvent/u.test(name)),
      outbox: [...calls].some((name) => /outbox|queueEmailEvent|queueBusinessEvent/u.test(name)),
      businessEvent: [...calls].some((name) => /BusinessEvent|businessEvent|publishDomainEvent/u.test(name)),
    },
  };
}

const classifications = [];
for (const absoluteAction of walk(path.join(root, "app")).sort()) {
  const actionPath = normalize(path.relative(root, absoluteAction));
  const actionFile = parse(absoluteAction);
  for (const action of exportedFunctions(actionFile)) {
    const service = serviceReference(actionFile, action.name);
    const id = `${actionPath}#${action.name}`;
    const serviceName = service?.aliases.get(`${action.name}UseCase`) ?? action.name;
    const resolved = service ? resolveUseCase(service.fileName, serviceName) : { file: actionFile, fileName: absoluteAction, useCase: action };
    const analysis = analyzeUseCase(resolved.file, resolved.useCase.node);
    const inputShape = resolved.useCase.parameters.map((parameter) => parameter.getText(resolved.file));
    classifications.push({
      id,
      actionFile: actionPath,
      exportName: action.name,
      inputShape,
      authentication: actionPath.includes("/(auth)/") && !["logoutAction"].includes(action.name) ? "public or optional session" : "trusted request/session boundary",
      authorization: analysis.authorization,
      operation: queryActions.has(id) || (!analysis.writes && /^(load|find|get)/u.test(action.name)) ? "QUERY" : "COMMAND",
      service: normalize(path.relative(root, resolved.fileName)),
      postEffects: analysis.postEffects,
    });
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), classifications }, null, 2)}\n`, "utf8");
process.stdout.write(`classified=${classifications.length} output=${normalize(path.relative(root, outputPath))}\n`);
