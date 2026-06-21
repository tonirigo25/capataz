import { spawnSync } from "node:child_process";

process.env.HOSTNAME ||= process.platform === "win32" ? "127.0.0.1" : "0.0.0.0";
process.env.PORT ||= "8080";

if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
  console.log("[start-standalone] Aplicando migraciones Prisma...");
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    console.error("[start-standalone] No se pudieron aplicar las migraciones Prisma.");
    process.exit(result.status ?? 1);
  }
} else {
  console.warn("[start-standalone] DATABASE_URL no es PostgreSQL; se omite prisma migrate deploy.");
}

await import("../.next/standalone/server.js");
