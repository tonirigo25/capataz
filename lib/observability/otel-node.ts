import { log, safeErrorCode } from "@/lib/observability/logger";
import { releaseMetadata } from "@/lib/observability/release";

let started = false;
let activeSdk: { shutdown(): Promise<void> } | undefined;

export async function registerOpenTelemetry() {
  if (started) return;
  started = true;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    log("info", "otel_noop_started", { status: "noop", ...loggableRelease() });
    return;
  }
  try {
    const [{ NodeSDK }, { OTLPTraceExporter }] = await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-http"),
    ]);
    const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, "")}/v1/traces` }) });
    await sdk.start();
    activeSdk = sdk;
    log("info", "otel_exporter_started", { status: "ready", ...loggableRelease() });
  } catch (error) {
    log("error", "otel_start_failed", { errorCode: safeErrorCode(error), ...loggableRelease() });
  }
}

export async function shutdownOpenTelemetry() {
  await activeSdk?.shutdown();
  activeSdk = undefined;
}

function loggableRelease() {
  const release = releaseMetadata();
  return { release: release.releaseSha, environment: release.environment, deploymentId: release.deploymentId };
}
