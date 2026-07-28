import { FakeAiProvider, FakeBillingProvider, FakeEmailProvider, FakeFiscalProvider, FakeObservabilityProvider, FakeStorageProvider } from "../../lib/platform/providers/fake";
import { runProviderContractSuite } from "../../lib/platform/providers/contract-suite";
import { HttpFiscalProvider, OpenAiGatewayProvider, OtelObservabilityProvider, ResendEmailProvider, S3StorageProvider, StripeBillingProvider } from "../../lib/platform/providers/production";

async function main() {
  const fake = await runProviderContractSuite({ billing: new FakeBillingProvider(), email: new FakeEmailProvider(), storage: new FakeStorageProvider(), ai: new FakeAiProvider(), fiscal: new FakeFiscalProvider(), observability: new FakeObservabilityProvider() });
  const objects = new Map<string, Uint8Array>();
  const s3Client = { async send(command: unknown) { const input = (command as { input: { Key: string; Body?: Uint8Array } }).input; if (input.Body) { objects.set(input.Key, input.Body); return { VersionId: "version-1" }; } return { Body: objects.get(input.Key) }; } };
  const okFetch: typeof fetch = async (input) => {
    const requestUrl = new URL(input instanceof Request ? input.url : String(input));
    const body = requestUrl.hostname === "api.openai.com"
      ? { id: "resp_contract", output_text: "contract output" }
      : { reference: "fiscal_reference" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const production = await runProviderContractSuite({
    billing: new StripeBillingProvider({ checkout: { sessions: { async create() { return { id: "cs_contract" }; } } }, billingPortal: { sessions: { async create() { return { id: "bps_contract" }; } } } }, () => new Date(0)),
    email: new ResendEmailProvider({ emails: { async send() { return { data: { id: "email_contract" } }; } } }, "sender@example.invalid", () => new Date(0)),
    storage: new S3StorageProvider(s3Client, "private-contract-bucket", () => new Date(0)),
    ai: new OpenAiGatewayProvider("test-key-never-sent", "test-model", okFetch, () => new Date(0)),
    fiscal: new HttpFiscalProvider(new URL("https://fiscal.example.invalid/transmit"), "test-authorization-never-sent", okFetch, () => new Date(0)),
    observability: new OtelObservabilityProvider(() => undefined),
  });
  console.log(JSON.stringify({ ok: true, fake, production, externalCalls: 0 }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
