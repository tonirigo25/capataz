export type ProviderMode = "fake" | "sandbox" | "live";

export type ProviderReceipt = {
  provider: string;
  mode: ProviderMode;
  reference: string;
  idempotencyKey: string;
  acceptedAt: string;
};

export interface BillingProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  createCheckout(input: { companyId: string; priceKey: string; returnUrl: string; idempotencyKey: string }): Promise<ProviderReceipt>;
}

export interface EmailDeliveryProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  send(input: { recipient: string; subject: string; text: string; idempotencyKey: string }): Promise<ProviderReceipt>;
}

export interface StorageProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  put(input: { companyId: string; objectKey: string; bytes: Uint8Array; contentType: string; idempotencyKey: string }): Promise<ProviderReceipt & { sha256: string }>;
  get(input: { companyId: string; objectKey: string }): Promise<Uint8Array>;
}

export interface AiGatewayProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  complete(input: { companyId: string; purpose: string; promptVersion: string; input: string; idempotencyKey: string; store: false }): Promise<ProviderReceipt & { output: string }>;
}

export interface FiscalTransmissionProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  transmit(input: { companyId: string; fiscalDocumentId: string; artifactHash: string; idempotencyKey: string }): Promise<ProviderReceipt>;
}

export interface ObservabilityProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  record(input: { event: string; requestId: string; fields: Record<string, string | number | boolean | null> }): Promise<void>;
}
