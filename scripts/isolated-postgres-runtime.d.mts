export interface IsolatedPostgresRuntime {
  pg: any;
  suite: string;
  port: number;
  dataDir: string;
  logLines: string[];
  stopped: boolean;
}

export class IsolatedPostgresStartupError extends Error {
  suite: string;
  port?: number;
  dataDir?: string;
  attempts: Array<Record<string, unknown>>;
  logFile?: string;
}

export function availableLoopbackPort(options?: { exclude?: Set<number> }): Promise<number>;
export function isLoopbackPortAvailable(port: number): Promise<boolean>;
export function startIsolatedPostgres(options: {
  EmbeddedPostgres: any;
  root: string;
  suite: string;
  password: string;
  preferredPort?: number | string;
  allowDynamicFallback?: boolean;
  maxAttempts?: number;
  startupTimeoutMs?: number;
  postgresFlags?: string[];
  usedPorts?: Set<number>;
  onLog?: (message: string) => void;
}): Promise<IsolatedPostgresRuntime>;
export function stopIsolatedPostgres(
  runtime?: IsolatedPostgresRuntime,
  options?: { stopTimeoutMs?: number },
): Promise<void>;
export function installCleanupSignalHandlers(
  cleanup: (signal: string) => void | Promise<void>,
): () => void;
export function terminateOwnedProcess(child?: any): void;
