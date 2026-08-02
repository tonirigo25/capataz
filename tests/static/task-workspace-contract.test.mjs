import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Tareas conserva tenant, permisos y una única ruta canónica", async () => {
  const [page, navigation] = await Promise.all([
    read("app/(app)/tareas/page.tsx"),
    read("lib/product-navigation.ts"),
  ]);
  assert.match(page, /requireCapability\("tasks\.view"\)/);
  assert.match(page, /companyId: auth\.companyId/);
  assert.match(page, /resolveScopedEntityIds\(auth, "work\.view", "Work"\)/);
  assert.match(page, /resolveScopedTaskIds\(auth, "tasks\.view"\)/);
  assert.match(navigation, /"\/obras": \[[\s\S]*href: "\/tareas"/);
});

test("la creación de tarea valida alcance interno de trabajo o cliente", async () => {
  const actions = await read("lib/application/operations/task-use-cases.ts");
  assert.match(actions, /assertScopedEntityAccess\(auth, "tasks\.manage", "Work", requestedWorkId\)/);
  assert.match(actions, /assertScopedEntityAccess\(auth, "tasks\.manage", "Client", requestedClientId\)/);
  assert.match(actions, /TASK_ASSIGNEE_NOT_AVAILABLE/);
  assert.match(actions, /createdById: auth\.userId/);
});

test("el workspace reproduce KPI, filtros, tabla y paginación de la maestra", async () => {
  const page = await read("app/(app)/tareas/page.tsx");
  for (const token of ["tasks-kpis", "TaskFilters", "tasks-table__header", "tasks-pagination", "Trabajo", "Tareas"]) {
    assert.match(page, new RegExp(token));
  }
  assert.match(page, /const pageSize = 7/);
  for (const period of ["today", "week", "month"]) assert.match(page, new RegExp(`periodo=${period}`));
  assert.match(page, /matchesPeriod/);
  assert.match(page, /context=\{\{ clientId: query\.clientId, workId: query\.workId/);
});

test("Trabajo muestra el detalle persistente en el viewport maestro", async () => {
  const portfolio = await read("components/portal/modules-a/work-portfolio.tsx");
  assert.doesNotMatch(portfolio, /1800px/);
  assert.match(portfolio, /min-width: 1560px/);
  assert.match(portfolio, /min-\[1560px\]:grid/);
});

test("la sidebar usa la densidad fina compartida", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /--fos-layout-sidebar: 236px/);
  assert.match(css, /\.field-os-sidebar__navigation a \{[\s\S]*font-size: 14px;[\s\S]*font-weight: 520;/);
});
