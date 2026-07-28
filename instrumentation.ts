export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOpenTelemetry } = await import("./lib/observability/otel-node");
    await registerOpenTelemetry();
  }
}
