import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function copyIfExists(from, to) {
  const src = path.join(root, from);
  const dest = path.join(root, to);

  if (!fs.existsSync(src)) {
    console.warn(`[prepare-standalone] No existe: ${from}`);
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`[prepare-standalone] Copiado ${from} -> ${to}`);
}

copyIfExists(".next/static", ".next/standalone/.next/static");
copyIfExists("public", ".next/standalone/public");
