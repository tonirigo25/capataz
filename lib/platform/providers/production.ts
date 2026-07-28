import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { AiGatewayProvider, BillingProvider, EmailDeliveryProvider, FiscalTransmissionProvider, ObservabilityProvider, ProviderReceipt, StorageProvider } from "./contracts";
import { openAiHttpRequest } from "@/lib/ai/openai-transport";
import { stableReference } from "@/lib/ai/redaction";

type Clock = () => Date;

function receipt(provider: string, reference: string, idempotencyKey: string, clock: Clock): ProviderReceipt {
  if (!reference) throw new Error("PROVIDER_REFERENCE_MISSING");
  return { provider, mode: "live", reference, idempotencyKey, acceptedAt: clock().toISOString() };
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";
  readonly mode = "live" as const;
  constructor(private readonly client: {
    checkout: { sessions: { create(input: object, options: { idempotencyKey: string }): Promise<{ id: string; url?: string | null }> } };
    billingPortal?: { sessions: { create(input: object, options: { idempotencyKey: string }): Promise<{ id: string; url?: string }> } };
  }, private readonly clock: Clock = () => new Date()) {}
  async createCheckout(input: { companyId: string; priceKey: string; customerId?: string; returnUrl: string; idempotencyKey: string }) {
    const returnUrl = new URL(input.returnUrl);
    if (returnUrl.protocol !== "https:") throw new Error("CHECKOUT_RETURN_URL_MUST_BE_HTTPS");
    const session = await this.client.checkout.sessions.create({ mode: "subscription", line_items: [{ price: input.priceKey, quantity: 1 }], success_url: returnUrl.href, cancel_url: returnUrl.href, client_reference_id: input.companyId, ...(input.customerId ? { customer: input.customerId } : {}), subscription_data: { metadata: { companyId: input.companyId } }, metadata: { companyId: input.companyId } }, { idempotencyKey: input.idempotencyKey });
    return { ...receipt(this.name, session.id, input.idempotencyKey, this.clock), ...(session.url ? { url: session.url } : {}) };
  }
  async createPortal(input: { companyId: string; customerId: string; returnUrl: string; idempotencyKey: string }) {
    if (!this.client.billingPortal) throw new Error("STRIPE_PORTAL_NOT_CONFIGURED");
    const returnUrl = new URL(input.returnUrl);
    if (returnUrl.protocol !== "https:" || !input.customerId) throw new Error("BILLING_PORTAL_INPUT_INVALID");
    const session = await this.client.billingPortal.sessions.create({ customer: input.customerId, return_url: returnUrl.href }, { idempotencyKey: input.idempotencyKey });
    return { ...receipt(this.name, session.id, input.idempotencyKey, this.clock), ...(session.url ? { url: session.url } : {}) };
  }
}

export class ResendEmailProvider implements EmailDeliveryProvider {
  readonly name = "resend";
  readonly mode = "live" as const;
  constructor(private readonly client: { emails: { send(input: object, options: { idempotencyKey: string }): Promise<{ data?: { id?: string } | null; error?: unknown }> } }, private readonly from: string, private readonly clock: Clock = () => new Date()) {}
  async send(input: { recipient: string; subject: string; text: string; idempotencyKey: string }) {
    const response = await this.client.emails.send({ from: this.from, to: input.recipient, subject: input.subject, text: input.text }, { idempotencyKey: input.idempotencyKey });
    if (response.error) throw new Error("EMAIL_PROVIDER_REJECTED");
    return receipt(this.name, response.data?.id ?? "", input.idempotencyKey, this.clock);
  }
}

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  readonly mode = "live" as const;
  constructor(private readonly client: { send(command: unknown): Promise<Record<string, unknown>> }, private readonly bucket: string, private readonly clock: Clock = () => new Date()) {}
  async put(input: { companyId: string; objectKey: string; bytes: Uint8Array; contentType: string; idempotencyKey: string }) {
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const key = scopedKey(input.companyId, input.objectKey);
    const response = await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.bytes, ContentType: input.contentType, ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"), Metadata: { company: input.companyId, sha256 } }));
    return { ...receipt(this.name, String(response.VersionId ?? response.ETag ?? key), input.idempotencyKey, this.clock), sha256 };
  }
  async get(input: { companyId: string; objectKey: string }) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: scopedKey(input.companyId, input.objectKey) }));
    const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | Uint8Array | undefined;
    if (body instanceof Uint8Array) return body;
    if (body?.transformToByteArray) return body.transformToByteArray();
    throw new Error("STORAGE_BODY_MISSING");
  }
  async delete(input: { companyId: string; objectKey: string; idempotencyKey: string }) {
    const key = scopedKey(input.companyId, input.objectKey);
    const response = await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return receipt(this.name, String(response.VersionId ?? key), input.idempotencyKey, this.clock);
  }
}

export class OpenAiGatewayProvider implements AiGatewayProvider {
  readonly name = "openai";
  readonly mode = "live" as const;
  constructor(private readonly apiKey: string, private readonly model: string, private readonly fetcher: typeof fetch = fetch, private readonly clock: Clock = () => new Date()) {}
  async complete(input: { companyId: string; purpose: string; promptVersion: string; input: string; idempotencyKey: string; store: false }) {
    if (input.store !== false) throw new Error("AI_STORE_MUST_BE_FALSE");
    const response = await openAiHttpRequest({ path: "responses", apiKey: this.apiKey, fetcher: this.fetcher, init: { method: "POST", headers: { "content-type": "application/json", "idempotency-key": input.idempotencyKey }, body: JSON.stringify({ model: this.model, input: input.input, store: false, metadata: { company_ref: stableReference(input.companyId), purpose: input.purpose, prompt_version: input.promptVersion } }) } });
    const body = await response.json() as { id?: string; output_text?: string; error?: unknown };
    if (!response.ok || body.error) throw new Error("AI_PROVIDER_REJECTED");
    return { ...receipt(this.name, body.id ?? "", input.idempotencyKey, this.clock), output: body.output_text ?? "" };
  }
}

export class HttpFiscalProvider implements FiscalTransmissionProvider {
  readonly name = "fiscal-http";
  readonly mode = "live" as const;
  constructor(private readonly endpoint: URL, private readonly authorization: string, private readonly fetcher: typeof fetch = fetch, private readonly clock: Clock = () => new Date()) {}
  async transmit(input: { companyId: string; fiscalDocumentId: string; artifactHash: string; idempotencyKey: string }) {
    if (this.endpoint.protocol !== "https:" || !/^[a-f0-9]{64}$/.test(input.artifactHash)) throw new Error("INVALID_FISCAL_TRANSMISSION");
    const response = await this.fetcher(this.endpoint, { method: "POST", headers: { authorization: this.authorization, "content-type": "application/json", "idempotency-key": input.idempotencyKey }, body: JSON.stringify(input) });
    const body = await response.json() as { reference?: string };
    if (!response.ok) throw new Error("FISCAL_PROVIDER_REJECTED");
    return receipt(this.name, body.reference ?? "", input.idempotencyKey, this.clock);
  }
}

export class OtelObservabilityProvider implements ObservabilityProvider {
  readonly name = "opentelemetry";
  readonly mode = "live" as const;
  constructor(private readonly recorder: (event: string, fields: Record<string, string | number | boolean | null>) => void) {}
  async record(input: { event: string; requestId: string; fields: Record<string, string | number | boolean | null> }) {
    this.recorder(input.event, { ...input.fields, requestId: input.requestId });
  }
}

function scopedKey(companyId: string, objectKey: string) {
  const clean = objectKey.replace(/^\/+/, "");
  if (!companyId || !clean || clean.includes("..")) throw new Error("INVALID_STORAGE_KEY");
  return `companies/${companyId}/${clean}`;
}
