import { createHash } from "node:crypto";
import type {
  AiGatewayProvider,
  BillingProvider,
  EmailDeliveryProvider,
  FiscalTransmissionProvider,
  ObservabilityProvider,
  ProviderReceipt,
  StorageProvider,
} from "./contracts";

function receipt(provider: string, idempotencyKey: string): ProviderReceipt {
  const reference = createHash("sha256").update(`${provider}:${idempotencyKey}`).digest("hex").slice(0, 24);
  return { provider, mode: "fake", reference, idempotencyKey, acceptedAt: "1970-01-01T00:00:00.000Z" };
}

export class FakeBillingProvider implements BillingProvider {
  readonly name = "fake-billing";
  readonly mode = "fake" as const;
  async createCheckout(input: { companyId: string; priceKey: string; customerId?: string; returnUrl: string; idempotencyKey: string }) {
    new URL(input.returnUrl);
    return receipt(this.name, input.idempotencyKey);
  }
  async createPortal(input: { companyId: string; customerId: string; returnUrl: string; idempotencyKey: string }) {
    new URL(input.returnUrl);
    if (!input.customerId) throw new Error("BILLING_CUSTOMER_REQUIRED");
    return receipt(this.name, input.idempotencyKey);
  }
}

export class FakeEmailProvider implements EmailDeliveryProvider {
  readonly name = "fake-email";
  readonly mode = "fake" as const;
  async send(input: { recipient: string; subject: string; text: string; idempotencyKey: string }) {
    if (!input.recipient.includes("@") || !input.subject || !input.text) throw new Error("INVALID_FAKE_EMAIL");
    return receipt(this.name, input.idempotencyKey);
  }
}

export class FakeStorageProvider implements StorageProvider {
  readonly name = "fake-storage";
  readonly mode = "fake" as const;
  private readonly objects = new Map<string, Uint8Array>();
  async put(input: { companyId: string; objectKey: string; bytes: Uint8Array; contentType: string; idempotencyKey: string }) {
    const key = `${input.companyId}/${input.objectKey}`;
    this.objects.set(key, input.bytes.slice());
    return { ...receipt(this.name, input.idempotencyKey), sha256: createHash("sha256").update(input.bytes).digest("hex") };
  }
  async get(input: { companyId: string; objectKey: string }) {
    const value = this.objects.get(`${input.companyId}/${input.objectKey}`);
    if (!value) throw new Error("FAKE_OBJECT_NOT_FOUND");
    return value.slice();
  }
  async delete(input: { companyId: string; objectKey: string; idempotencyKey: string }) {
    this.objects.delete(`${input.companyId}/${input.objectKey}`);
    return receipt(this.name, input.idempotencyKey);
  }
}

export class FakeAiProvider implements AiGatewayProvider {
  readonly name = "fake-ai";
  readonly mode = "fake" as const;
  async complete(input: { companyId: string; purpose: string; promptVersion: string; input: string; idempotencyKey: string; store: false }) {
    if (input.store !== false) throw new Error("AI_STORE_MUST_BE_FALSE");
    return { ...receipt(this.name, input.idempotencyKey), output: `[fake:${input.purpose}:${input.promptVersion}]` };
  }
}

export class FakeFiscalProvider implements FiscalTransmissionProvider {
  readonly name = "fake-fiscal";
  readonly mode = "fake" as const;
  async transmit(input: { companyId: string; fiscalDocumentId: string; artifactHash: string; idempotencyKey: string }) {
    if (!/^[a-f0-9]{64}$/.test(input.artifactHash)) throw new Error("INVALID_ARTIFACT_HASH");
    return receipt(this.name, input.idempotencyKey);
  }
}

export class FakeObservabilityProvider implements ObservabilityProvider {
  readonly name = "fake-observability";
  readonly mode = "fake" as const;
  readonly events: Array<{ event: string; requestId: string; fields: Record<string, string | number | boolean | null> }> = [];
  async record(input: { event: string; requestId: string; fields: Record<string, string | number | boolean | null> }) {
    this.events.push(structuredClone(input));
  }
}
