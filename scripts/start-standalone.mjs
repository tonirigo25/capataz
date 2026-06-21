process.env.HOSTNAME ||= process.platform === "win32" ? "127.0.0.1" : "0.0.0.0";
process.env.PORT ||= "8080";

await import("../.next/standalone/server.js");
