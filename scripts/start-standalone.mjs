import { existsSync } from "node:fs";

process.env.HOSTNAME ||= process.platform === "win32" ? "127.0.0.1" : "0.0.0.0";
process.env.PORT ||= "8080";

const standaloneServer = new URL("../.next/standalone/server.js", import.meta.url);

if (!existsSync(standaloneServer)) {
  console.error("[start-standalone] No se encontró el servidor standalone generado. Ejecuta npm run build antes de arrancar.");
  process.exit(1);
}

await import(standaloneServer.href);
