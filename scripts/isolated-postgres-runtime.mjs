import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const LOOPBACK = "127.0.0.1";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_STARTUP_TIMEOUT_MS = 45_000;
const DEFAULT_STOP_TIMEOUT_MS = 15_000;

export class IsolatedPostgresStartupError extends Error {
  constructor({ suite, attempts, cause }) {
    const last = attempts.at(-1) ?? {};
    super(
      [
        `ISOLATED_POSTGRES_START_FAILED suite=${suite}`,
        `port=${last.port ?? "unassigned"}`,
        `dataDir=${last.dataDir ?? "unassigned"}`,
        `attempts=${attempts.length}`,
        `logFile=${last.logFile ?? "none"}`,
        `cause=${cause?.message ?? last.message ?? "unknown"}`,
      ].join(" "),
      { cause },
    );
    this.name = "IsolatedPostgresStartupError";
    this.suite = suite;
    this.port = last.port;
    this.dataDir = last.dataDir;
    this.attempts = attempts;
    this.logFile = last.logFile;
  }
}

export async function availableLoopbackPort({ exclude = new Set() } = {}) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const port = await bindPort(0);
    if (!exclude.has(port)) return port;
  }
  throw new Error("ISOLATED_POSTGRES_PORT_ALLOCATION_EXHAUSTED");
}

export async function isLoopbackPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return false;
  try {
    await bindPort(port);
    return true;
  } catch (error) {
    if (error?.code === "EADDRINUSE" || error?.code === "EACCES") return false;
    throw error;
  }
}

export async function startIsolatedPostgres({
  EmbeddedPostgres,
  root,
  suite,
  password,
  preferredPort,
  allowDynamicFallback = true,
  maxAttempts = Number(process.env.CAPATAZ_POSTGRES_START_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
  startupTimeoutMs = Number(process.env.CAPATAZ_POSTGRES_START_TIMEOUT_MS ?? DEFAULT_STARTUP_TIMEOUT_MS),
  postgresFlags = [],
  usedPorts = new Set(),
  onLog,
}) {
  if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
  if (!suite) throw new Error("ISOLATED_POSTGRES_SUITE_REQUIRED");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("ISOLATED_POSTGRES_INVALID_MAX_ATTEMPTS");
  if (!Number.isFinite(startupTimeoutMs) || startupTimeoutMs < 1) throw new Error("ISOLATED_POSTGRES_INVALID_START_TIMEOUT");

  const attempts = [];
  const safeSuite = suite.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "suite";
  const requestedPort = normalizePort(preferredPort);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let port;
    if (attempt === 1 && requestedPort) {
      const available = !usedPorts.has(requestedPort) && await isLoopbackPortAvailable(requestedPort);
      if (available) {
        port = requestedPort;
      } else if (!allowDynamicFallback) {
        const unavailable = {
          attempt,
          port: requestedPort,
          dataDir: join(root, `${safeSuite}-${process.pid}-${Date.now()}-${attempt}`),
          message: "EADDRINUSE",
        };
        attempts.push(unavailable);
        throw new IsolatedPostgresStartupError({
          suite,
          attempts,
          cause: Object.assign(new Error(`EADDRINUSE:${requestedPort}`), { code: "EADDRINUSE" }),
        });
      }
    }
    port ??= await availableLoopbackPort({ exclude: usedPorts });
    usedPorts.add(port);

    const dataDir = join(root, `${safeSuite}-${process.pid}-${Date.now()}-${attempt}`);
    const logLines = [];
    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "postgres",
      password,
      port,
      persistent: false,
      postgresFlags,
      onLog(message) {
        const text = String(message);
        logLines.push(text);
        onLog?.(text);
      },
      onError(error) {
        const text = error?.stack ?? error?.message ?? String(error);
        logLines.push(text);
        onLog?.(text);
      },
    });

    try {
      await pg.initialise();
      await withTimeout(
        pg.start(),
        startupTimeoutMs,
        `ISOLATED_POSTGRES_START_TIMEOUT suite=${suite} port=${port} dataDir=${dataDir}`,
      );
      process.stdout.write(`[isolated-postgres] suite=${suite} port=${port} dataDir=${dataDir}\n`);
      return {
        pg,
        suite,
        port,
        dataDir,
        logLines,
        stopped: false,
      };
    } catch (error) {
      const logFile = preserveFailureLog({ suite: safeSuite, port, dataDir, attempt, error, logLines });
      attempts.push({
        attempt,
        port,
        dataDir,
        logFile,
        message: error?.message ?? String(error),
      });
      await stopIsolatedPostgres({ pg, suite, port, dataDir, logLines, stopped: false }).catch(() => undefined);
      if (attempt === maxAttempts) {
        throw new IsolatedPostgresStartupError({ suite, attempts, cause: error });
      }
    }
  }

  throw new IsolatedPostgresStartupError({ suite, attempts, cause: new Error("ISOLATED_POSTGRES_ATTEMPTS_EXHAUSTED") });
}

export async function stopIsolatedPostgres(runtime, {
  stopTimeoutMs = Number(process.env.CAPATAZ_POSTGRES_STOP_TIMEOUT_MS ?? DEFAULT_STOP_TIMEOUT_MS),
} = {}) {
  if (!runtime || runtime.stopped) return;
  runtime.stopped = true;
  const child = runtime.pg?.process;
  const pid = child?.pid;
  let stopError;

  if (!child || child.exitCode !== null || child.signalCode !== null) {
    releaseRuntimeHandles(runtime, child);
    removeDataDirectory(runtime.dataDir);
    return;
  }

  try {
    if (process.platform === "win32" && pid) {
      const terminated = spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      });
      if (terminated.error) throw terminated.error;
      await waitForChildClose(
        child,
        stopTimeoutMs,
        `ISOLATED_POSTGRES_STOP_TIMEOUT suite=${runtime.suite} port=${runtime.port} pid=${pid}`,
      );
    } else {
      await withTimeout(
        Promise.resolve(runtime.pg?.stop()),
        stopTimeoutMs,
        `ISOLATED_POSTGRES_STOP_TIMEOUT suite=${runtime.suite} port=${runtime.port} pid=${pid ?? "none"}`,
      );
    }
  } catch (error) {
    stopError = error;
    if (process.platform === "win32" && pid) {
      spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else if (child && !child.killed) {
      child.kill("SIGKILL");
    }
  } finally {
    releaseRuntimeHandles(runtime, child);
    removeDataDirectory(runtime.dataDir);
  }

  if (stopError) throw stopError;
}

function releaseRuntimeHandles(runtime, child) {
  child?.stdin?.destroy();
  child?.stdout?.destroy();
  child?.stderr?.destroy();
  child?.removeAllListeners();
  if (runtime.pg) runtime.pg.process = undefined;
}

function removeDataDirectory(dataDir) {
  rmSync(dataDir, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

async function waitForChildClose(child, timeoutMs, message) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await withTimeout(
    new Promise((resolve) => child.once("close", resolve)),
    timeoutMs,
    message,
  );
}

export function installCleanupSignalHandlers(cleanup) {
  let cleaning = false;
  const handler = (signal) => {
    if (cleaning) return;
    cleaning = true;
    Promise.resolve(cleanup(signal))
      .catch((error) => {
        process.stderr.write(`[isolated-postgres] cleanup failed signal=${signal} error=${error?.stack ?? error}\n`);
        process.exitCode = 1;
      })
      .finally(() => {
        process.exit(process.exitCode || 128);
      });
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}

export function terminateOwnedProcess(child) {
  const pid = child?.pid;
  if (!pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (!child.killed) {
    child.kill("SIGKILL");
  }
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function bindPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen({ host: LOOPBACK, port, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("ISOLATED_POSTGRES_PORT_UNAVAILABLE")));
        return;
      }
      const selected = address.port;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

function normalizePort(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`ISOLATED_POSTGRES_INVALID_PORT:${value}`);
  }
  return port;
}

function preserveFailureLog({ suite, port, dataDir, attempt, error, logLines }) {
  const logRoot = join(tmpdir(), "capataz-postgres-failures");
  mkdirSync(logRoot, { recursive: true });
  const logFile = join(logRoot, `${suite}-${process.pid}-${Date.now()}-${attempt}.log`);
  writeFileSync(
    logFile,
    [
      `suite=${suite}`,
      `port=${port}`,
      `dataDir=${dataDir}`,
      `error=${error?.stack ?? error?.message ?? String(error)}`,
      "",
      ...logLines,
    ].join("\n"),
    "utf8",
  );
  return logFile;
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}
