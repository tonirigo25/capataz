import type { AiGatewayProvider, BillingProvider, EmailDeliveryProvider, FiscalTransmissionProvider, ObservabilityProvider, StorageProvider } from "./contracts";

export async function runProviderContractSuite(providers: { billing: BillingProvider; email: EmailDeliveryProvider; storage: StorageProvider; ai: AiGatewayProvider; fiscal: FiscalTransmissionProvider; observability: ObservabilityProvider }) {
  const billing = await providers.billing.createCheckout({ companyId: "contract-company", priceKey: "price_contract", returnUrl: "https://example.invalid/return", idempotencyKey: "billing-contract" });
  const portal = await providers.billing.createPortal({ companyId: "contract-company", customerId: "customer_contract", returnUrl: "https://example.invalid/return", idempotencyKey: "portal-contract" });
  const email = await providers.email.send({ recipient: "contract@example.invalid", subject: "Contract", text: "Contract body", idempotencyKey: "email-contract" });
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const stored = await providers.storage.put({ companyId: "contract-company", objectKey: "contract/object.bin", bytes, contentType: "application/octet-stream", idempotencyKey: "storage-contract" });
  const downloaded = await providers.storage.get({ companyId: "contract-company", objectKey: "contract/object.bin" });
  const ai = await providers.ai.complete({ companyId: "contract-company", purpose: "contract", promptVersion: "v1", input: "test", idempotencyKey: "ai-contract", store: false });
  const fiscal = await providers.fiscal.transmit({ companyId: "contract-company", fiscalDocumentId: "fiscal-contract", artifactHash: "a".repeat(64), idempotencyKey: "fiscal-contract" });
  await providers.observability.record({ event: "provider.contract", requestId: "request-contract", fields: { ok: true } });
  for (const [name, value, key] of [["billing", billing, "billing-contract"], ["portal", portal, "portal-contract"], ["email", email, "email-contract"], ["storage", stored, "storage-contract"], ["ai", ai, "ai-contract"], ["fiscal", fiscal, "fiscal-contract"]] as const) {
    if (!value.reference || value.idempotencyKey !== key || !["fake", "sandbox", "live"].includes(value.mode)) throw new Error(`PROVIDER_CONTRACT_FAILED:${name}`);
  }
  if (downloaded.length !== bytes.length || stored.sha256.length !== 64 || typeof ai.output !== "string") throw new Error("PROVIDER_CONTRACT_PAYLOAD_FAILED");
  return { ok: true, providers: 6 };
}
