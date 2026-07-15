import { appendFileSync } from "node:fs";
import { inspect } from "node:util";

const reportFile = process.env.CAPATAZ_ACTIVE_HANDLE_REPORT_FILE;
const label = process.env.CAPATAZ_ACTIVE_HANDLE_LABEL ?? `${process.pid}`;
const watchdogMs = Number(process.env.CAPATAZ_ACTIVE_HANDLE_WATCHDOG_MS ?? 0);

function summarizeHandle(handle) {
  const base = { type: handle?.constructor?.name ?? typeof handle };
  if (handle && typeof handle === "object") {
    if ("pid" in handle) base.pid = handle.pid;
    if ("spawnfile" in handle) base.spawnfile = handle.spawnfile;
    if ("spawnargs" in handle) base.spawnargs = handle.spawnargs;
    if ("fd" in handle) base.fd = handle.fd;
    if ("connecting" in handle) base.connecting = handle.connecting;
    if ("destroyed" in handle) base.destroyed = handle.destroyed;
    if (typeof handle.address === "function") {
      try { base.address = handle.address(); } catch {}
    }
    if ("remoteAddress" in handle) base.remoteAddress = handle.remoteAddress;
    if ("remotePort" in handle) base.remotePort = handle.remotePort;
    if ("localAddress" in handle) base.localAddress = handle.localAddress;
    if ("localPort" in handle) base.localPort = handle.localPort;
  }
  return base;
}

function summarizeRequest(request) {
  return { type: request?.constructor?.name ?? typeof request, detail: inspect(request, { depth: 1, breakLength: 180 }) };
}

function dump(reason) {
  if (!reportFile) return;
  const payload = {
    at: new Date().toISOString(),
    reason,
    label,
    pid: process.pid,
    argv: process.argv,
    handles: process._getActiveHandles().map(summarizeHandle),
    requests: process._getActiveRequests().map(summarizeRequest)
  };
  appendFileSync(reportFile, `${JSON.stringify(payload)}\n`);
}

process.on("beforeExit", () => dump("beforeExit"));
process.on("exit", () => dump("exit"));
process.on("SIGTERM", () => { dump("SIGTERM"); process.exit(143); });
process.on("SIGINT", () => { dump("SIGINT"); process.exit(130); });

if (watchdogMs > 0) {
  const timer = setInterval(() => dump("watchdog"), watchdogMs);
  timer.unref();
}

dump("loaded");
