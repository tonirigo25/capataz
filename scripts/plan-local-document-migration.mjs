import { readdir, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

if (process.argv.includes("--apply")) {
  console.error("LOCAL_DOCUMENT_MIGRATION_APPLY_DISABLED");
  process.exit(2);
}

const configured = process.env.DOCUMENT_STORAGE_ROOT?.trim();
if (!configured) {
  console.log(JSON.stringify({ ok: true, mode: "dry-run", files: 0, bytes: 0, note: "DOCUMENT_STORAGE_ROOT" }));
  process.exit(0);
}

const root = resolve(configured);
if (!isAbsolute(root) || root === resolve(root, sep)) {
  console.error("DOCUMENT_STORAGE_ROOT");
  process.exit(1);
}

const inventory = [];
await walk(root, inventory);
console.log(JSON.stringify({
  ok: true,
  mode: "dry-run",
  files: inventory.length,
  bytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
  requiresDatabaseMapping: true,
  sourceRoot: root,
}));

async function walk(directory, inventory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    const offset = relative(root, target);
    if (!offset || offset === ".." || offset.startsWith(`..${sep}`)) throw new Error("DOCUMENT_STORAGE_PATH_INVALID");
    if (entry.isDirectory()) await walk(target, inventory);
    else if (entry.isFile()) inventory.push({ path: offset, bytes: (await stat(target)).size });
  }
}
