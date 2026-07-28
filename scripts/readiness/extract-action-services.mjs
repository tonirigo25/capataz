import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const targets = {
  "app/(auth)/actions.ts": "lib/application/auth/auth-use-cases.ts",
  "app/seleccionar-empresa/actions.ts": "lib/application/tenancy/select-company-use-case.ts",
  "app/crear-empresa/actions.ts": "lib/application/tenancy/create-company-use-case.ts",
  "app/(app)/onboarding/actions.ts": "lib/application/company/onboarding-use-case.ts",
  "app/(app)/configuracion/actions.ts": "lib/application/company/settings-use-cases.ts",
  "app/(app)/equipo/actions.ts": "lib/application/company/membership-use-cases.ts",
  "app/(app)/equipos/actions.ts": "lib/application/company/team-use-cases.ts",
  "app/(app)/clientes/actions.ts": "lib/application/operations/client-use-cases.ts",
  "app/(app)/obras/actions.ts": "lib/application/operations/work-use-cases.ts",
  "app/(app)/gestion/actions.ts": "lib/application/operations/management-use-cases.ts",
  "app/(app)/tareas/actions.ts": "lib/application/operations/task-use-cases.ts",
  "app/(app)/seguimientos/actions.ts": "lib/application/operations/follow-up-use-cases.ts",
  "app/(app)/alertas/actions.ts": "lib/application/operations/alert-use-cases.ts",
  "app/(app)/agenda/actions.ts": "lib/application/operations/agenda-use-cases.ts",
  "app/(app)/recordatorios/actions.ts": "lib/application/operations/reminder-use-cases.ts",
  "app/(app)/presupuestos/actions.ts": "lib/application/finance/budget-use-cases.ts",
  "app/(app)/dinero/actions.ts": "lib/application/finance/receivables-use-cases.ts",
  "app/(app)/tesoreria/actions.ts": "lib/application/finance/treasury-use-cases.ts",
  "app/(app)/gastos-materiales/actions.ts": "lib/application/finance/expense-use-cases.ts",
  "app/(app)/proveedores/actions.ts": "lib/application/finance/procurement-use-cases.ts",
  "app/(app)/automatizaciones/actions.ts": "lib/application/automation/automation-use-cases.ts",
  "app/(app)/capataz/actions.ts": "lib/orqena/application/capataz-use-cases.ts",
  "app/(app)/demo-guiada/actions.ts": "lib/application/demo/guided-demo-use-case.ts",
  "app/(app)/plan-y-uso/actions.ts": "lib/application/billing/plan-use-case.ts",
  "app/(app)/configuracion/memoria/actions.ts": "lib/application/company/memory-use-case.ts",
  "app/(app)/notificaciones/actions.ts": "lib/application/operations/notification-use-cases.ts",
  "app/(app)/plataforma/actions.ts": "lib/application/platform/platform-admin-use-cases.ts",
  "app/(app)/recomendaciones/actions.ts": "lib/application/intelligence/recommendation-use-cases.ts",
  "app/(app)/recomendaciones/control/actions.ts": "lib/application/intelligence/proactive-control-use-case.ts",
  "app/aceptar-invitacion/actions.ts": "lib/application/company/accept-invitation-use-case.ts",
};

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function exportedBoundary(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = [];
  const types = [];
  for (const statement of file.statements) {
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
        throw new Error(`Non-async action export ${fileName}:${statement.name.text}`);
      }
      const parameters = statement.parameters.map((parameter) => parameter.getText(file));
      const argumentsList = statement.parameters.map((parameter) => {
        if (!ts.isIdentifier(parameter.name)) throw new Error(`Unsupported action binding ${fileName}:${statement.name.text}`);
        return parameter.name.text;
      });
      functions.push({ name: statement.name.text, parameters, argumentsList });
    } else if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      types.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isArrowFunction(declaration.initializer) || !declaration.initializer.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
          throw new Error(`Unsupported exported value in ${fileName}`);
        }
        const parameters = declaration.initializer.parameters.map((parameter) => parameter.getText(file));
        const argumentsList = declaration.initializer.parameters.map((parameter) => {
          if (!ts.isIdentifier(parameter.name)) throw new Error(`Unsupported action binding ${fileName}:${declaration.name.text}`);
          return parameter.name.text;
        });
        functions.push({ name: declaration.name.text, parameters, argumentsList });
      }
    }
  }
  return { functions, types };
}

function applicationSource(source) {
  let result = source.replace(/^\uFEFF?\s*["']use server["'];?\s*/u, "");
  const cacheImport = /import\s*\{\s*revalidatePath\s*\}\s*from\s*["']next\/cache["'];?/u;
  const navigationImport = /import\s*\{\s*redirect\s*\}\s*from\s*["']next\/navigation["'];?/u;
  const needsCache = cacheImport.test(result);
  const needsNavigation = navigationImport.test(result);
  result = result.replace(cacheImport, "").replace(navigationImport, "");
  const adapters = [];
  if (needsCache) adapters.push("invalidateActionPath as revalidatePath");
  if (needsNavigation) adapters.push("navigateAction as redirect");
  if (adapters.length) result = `import { ${adapters.join(", ")} } from "@/lib/application/action-effects";\n${result.trimStart()}`;
  return result;
}

function wrapperSource(actionPath, servicePath, boundary) {
  const alias = `@/${normalize(servicePath).replace(/\.ts$/u, "")}`;
  const imports = boundary.functions.map(({ name }) => `${name} as ${name}UseCase`).join(", ");
  const lines = [
    '"use server";',
    "",
    'import { executeNextAction } from "@/lib/platform/next-action-boundary";',
    `import { ${imports} } from "${alias}";`,
  ];
  if (boundary.types.length) lines.push(`export type { ${boundary.types.join(", ")} } from "${alias}";`);
  lines.push("");
  for (const fn of boundary.functions) {
    lines.push(`export async function ${fn.name}(${fn.parameters.join(", ")}) {`);
    lines.push(`  return executeNextAction({ operation: "${normalize(actionPath)}#${fn.name}" }, () => ${fn.name}UseCase(${fn.argumentsList.join(", ")}));`);
    lines.push("}", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

for (const [actionPath, servicePath] of Object.entries(targets)) {
  const absoluteAction = path.join(root, actionPath);
  const absoluteService = path.join(root, servicePath);
  if (!fs.existsSync(absoluteAction)) throw new Error(`Missing action source ${actionPath}`);
  if (fs.existsSync(absoluteService)) {
    const existingBoundary = fs.readFileSync(absoluteAction, "utf8");
    if (!existingBoundary.includes("@/lib/platform/next-action-boundary")) throw new Error(`Refusing ambiguous existing service ${servicePath}`);
    process.stdout.write(`${actionPath} already extracted\n`);
    continue;
  }
  const source = fs.readFileSync(absoluteAction, "utf8");
  const boundary = exportedBoundary(source, actionPath);
  if (!boundary.functions.length) throw new Error(`No action exports in ${actionPath}`);
  fs.mkdirSync(path.dirname(absoluteService), { recursive: true });
  fs.writeFileSync(absoluteService, applicationSource(source), "utf8");
  fs.writeFileSync(absoluteAction, wrapperSource(actionPath, servicePath, boundary), "utf8");
  process.stdout.write(`${actionPath} -> ${servicePath} (${boundary.functions.length})\n`);
}
