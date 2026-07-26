import http from "node:http";
import { trace } from "@opentelemetry/api";
import { availableLoopbackPort } from "../isolated-postgres-runtime.mjs";

const port = await availableLoopbackPort();
const received = [];
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    received.push({ path: request.url, contentType: request.headers["content-type"], bytes: Buffer.concat(chunks).length });
    response.writeHead(200).end();
  });
});
await new Promise((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${port}`;
process.env.NEXT_PUBLIC_APP_ENV = "test";
try {
  const { registerOpenTelemetry, shutdownOpenTelemetry } = await import("../../lib/observability/otel-node.ts");
  await registerOpenTelemetry();
  const span = trace.getTracer("orqena-readiness").startSpan("f2-export-smoke");
  span.setAttribute("test.safe", true);
  span.end();
  await shutdownOpenTelemetry();
  if (received.length !== 1 || received[0].path !== "/v1/traces" || received[0].bytes < 1) throw new Error(`OTEL_EXPORT_NOT_OBSERVED:${JSON.stringify(received)}`);
  console.log(JSON.stringify({ ok: true, requests: received.length, path: received[0].path, bytesPositive: received[0].bytes > 0 }));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
