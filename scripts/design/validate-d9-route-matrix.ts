import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getRouteExperienceMatches,
  type RouteExperienceRule,
} from "../../lib/route-experience-manifest";

const REQUIRED_MATRIX_COLUMNS = [
  "area",
  "ruta",
  "patron_actual",
  "diseno_desktop_propuesto",
  "diseno_mobile_propuesto",
  "accion_primaria",
  "funcionalidad_a_preservar",
  "reducir_o_mover",
  "perfiles",
  "mockup",
] as const;

const STATE_DIMENSIONS = [
  "primaryAction",
  "mobile",
  "loading",
  "empty",
  "error",
  "restricted",
  "readOnly",
  "demo",
  "archive",
  "destructiveConfirmation",
  "permissionScope",
] as const;

type MatrixRow = Record<(typeof REQUIRED_MATRIX_COLUMNS)[number], string>;

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return files.flat();
}

function toRoute(appRoot: string, filename: string) {
  const relative = path.relative(appRoot, filename).replaceAll("\\", "/");
  const segments = relative
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "")
    .split("/")
    .filter(Boolean);
  const visible = segments.filter((segment) => !segment.startsWith("("));
  return `/${visible.join("/")}` || "/";
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV inválido: comillas sin cerrar");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

function requireUnique(values: string[], label: string) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) {
    throw new Error(`${label}: duplicados ${[...new Set(duplicates)].join(", ")}`);
  }
}

function validateAccessSemantics(route: string, experience: RouteExperienceRule) {
  const expectedScope = {
    public: "public",
    anonymous: "anonymous",
    membership: "membership",
    capability: "capability-and-scope",
    platform: "platform-owner",
  }[experience.access];
  if (experience.permissionScope !== expectedScope) {
    throw new Error(`${route}: permissionScope=${experience.permissionScope}; esperado=${expectedScope}`);
  }
  if (experience.access === "public" && experience.restricted !== "not-applicable") {
    throw new Error(`${route}: una ruta pública no puede declarar un redirect restringido`);
  }
  if (experience.access === "anonymous" && experience.readOnly !== "not-applicable") {
    throw new Error(`${route}: una ruta anónima no puede declarar read-only autenticado`);
  }
}

async function main() {
  const repositoryRoot = process.cwd();
  const appRoot = path.join(repositoryRoot, "app");
  const matrixPath = path.join(repositoryRoot, "docs", "design", "ROUTE_MATRIX.csv");
  const pages = (await walk(appRoot))
    .filter((filename) => filename.endsWith(`${path.sep}page.tsx`) || filename === path.join(appRoot, "page.tsx"))
    .map((filename) => ({
      route: toRoute(appRoot, filename),
      file: path.relative(repositoryRoot, filename).replaceAll("\\", "/"),
    }))
    .sort((left, right) => left.route.localeCompare(right.route));

  requireUnique(pages.map((page) => page.route), "Inventario de páginas");

  const parsed = parseCsv((await readFile(matrixPath, "utf8")).replace(/^\uFEFF/, ""));
  const headers = parsed.shift();
  if (!headers || headers.join("|") !== REQUIRED_MATRIX_COLUMNS.join("|")) {
    throw new Error(`Cabecera inesperada en ${path.relative(repositoryRoot, matrixPath)}`);
  }
  const matrix = parsed.map((values, index) => {
    if (values.length !== REQUIRED_MATRIX_COLUMNS.length) {
      throw new Error(`Fila ${index + 2}: ${values.length} columnas; esperadas ${REQUIRED_MATRIX_COLUMNS.length}`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()])) as MatrixRow;
  });
  requireUnique(matrix.map((row) => row.ruta), "Matriz de rutas");

  const emptyCells = matrix.flatMap((row, index) =>
    REQUIRED_MATRIX_COLUMNS
      .filter((column) => !row[column])
      .map((column) => ({ row: index + 2, route: row.ruta, column })),
  );
  if (emptyCells.length) throw new Error(`La matriz contiene celdas vacías: ${JSON.stringify(emptyCells)}`);

  const pageRoutes = new Set(pages.map((page) => page.route));
  const matrixRoutes = new Set(matrix.map((row) => row.ruta));
  const missingFromMatrix = pages.filter((page) => !matrixRoutes.has(page.route));
  const orphanedMatrixRows = matrix.filter((row) => !pageRoutes.has(row.ruta));
  if (missingFromMatrix.length || orphanedMatrixRows.length) {
    throw new Error(JSON.stringify({ missingFromMatrix, orphanedMatrixRows }, null, 2));
  }

  const compiled = pages.map((page) => {
    const matrixRow = matrix.find((row) => row.ruta === page.route);
    const matches = getRouteExperienceMatches(page.route);
    if (!matrixRow || matches.length !== 1) {
      throw new Error(`${page.route}: fila=${Boolean(matrixRow)} reglas=${matches.map((match) => match.id).join(",")}`);
    }
    const experience = matches[0];
    validateAccessSemantics(page.route, experience);
    for (const dimension of STATE_DIMENSIONS) {
      if (!experience[dimension]) throw new Error(`${page.route}: falta ${dimension}`);
    }
    return {
      route: page.route,
      file: page.file,
      matrixArea: matrixRow.area,
      matrixPrimaryAction: matrixRow.accion_primaria,
      pattern: experience.id,
      primaryAction: experience.primaryAction,
      mobile: experience.mobile,
      loading: experience.loading,
      empty: experience.empty,
      error: experience.error,
      restricted: experience.restricted,
      readOnly: experience.readOnly,
      demo: experience.demo,
      archive: experience.archive,
      destructiveConfirmation: experience.destructiveConfirmation,
      permissionScope: experience.permissionScope,
    };
  });

  for (const route of ["/demo", "/demo-v2"]) {
    const entry = compiled.find((item) => item.route === route);
    if (entry?.demo !== "public-synthetic") throw new Error(`${route}: demo pública no acreditada como sintética`);
  }
  for (const route of ["/clientes/[id]", "/obras/[id]", "/seguimientos/[id]", "/tareas/[id]", "/capataz"]) {
    const entry = compiled.find((item) => item.route === route);
    if (entry?.archive !== "available" || entry.destructiveConfirmation !== "required") {
      throw new Error(`${route}: archivo y confirmación destructiva no acreditados`);
    }
  }

  const confirmationSources = await Promise.all([
    "app/(app)/clientes/[id]/page.tsx",
    "app/(app)/obras/[id]/page.tsx",
    "app/(app)/seguimientos/[id]/page.tsx",
    "app/(app)/tareas/[id]/page.tsx",
    "components/capataz-chat.tsx",
  ].map(async (filename) => ({
    filename,
    source: await readFile(path.join(repositoryRoot, filename), "utf8"),
  })));
  for (const { filename, source } of confirmationSources.slice(0, 4)) {
    if (!source.includes("ConfirmSubmitButton")) {
      throw new Error(`${filename}: falta confirmación accesible antes del archivo`);
    }
  }
  if (!confirmationSources[4].source.includes("window.confirm")) {
    throw new Error("components/capataz-chat.tsx: falta confirmación antes de borrar una conversación");
  }

  const evidence = {
    ok: true,
    matrix: path.relative(repositoryRoot, matrixPath).replaceAll("\\", "/"),
    routes: compiled.length,
    uniqueRoutes: new Set(compiled.map((entry) => entry.route)).size,
    orphanedRoutes: 0,
    stateDimensions: STATE_DIMENSIONS,
    destructiveConfirmationSources: confirmationSources.map(({ filename }) => filename),
    compiled,
  };
  const artifactDirectory = path.join(repositoryRoot, "artifacts", "design-d9");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(
    path.join(artifactDirectory, "route-matrix-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  console.log(`[design-d9] ${compiled.length}/${compiled.length} rutas con matriz y manifiesto`);
  console.log(`[design-d9] 0 rutas huérfanas; ${STATE_DIMENSIONS.length}/${STATE_DIMENSIONS.length} controles por ruta`);
  console.log("[design-d9] evidencia: artifacts/design-d9/route-matrix-evidence.json");
}

main().catch((error) => {
  console.error("[design-d9] FAIL", error);
  process.exit(1);
});
