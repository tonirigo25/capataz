import type { Prisma, PrismaClient } from "@prisma/client";
import type { FiscalTransmissionProvider, ProviderReceipt } from "@/lib/platform/providers/contracts";
import { canonicalJson, sha256Hex } from "./canonical";
import { classifyLegacyFiscalDocument, type FiscalActivation } from "./engine";

type TransmissionResult = { transmissionId: string; receipt: ProviderReceipt; replayed: boolean };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function transmitFiscalDocument(
  prisma: PrismaClient,
  input: { companyId: string; fiscalDocumentId: string; artifactHash: string; idempotencyKey: string },
  provider: FiscalTransmissionProvider,
  activation: FiscalActivation,
): Promise<TransmissionResult> {
  if (!activation.enabled) throw new Error("FISCAL_ENGINE_DISABLED");
  if (provider.mode === "live" && !activation.allowLiveTransmission) throw new Error("FISCAL_LIVE_TRANSMISSION_BLOCKED");
  if (!/^[a-f0-9]{64}$/u.test(input.artifactHash)) throw new Error("FISCAL_ARTIFACT_HASH_INVALID");
  const document = await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: input.fiscalDocumentId } });
  if (document.companyId !== input.companyId) throw new Error("FISCAL_CROSS_TENANT_DOCUMENT");
  if (document.status !== "ISSUED") throw new Error("FISCAL_DOCUMENT_NOT_TRANSMITTABLE");
  if (!classifyLegacyFiscalDocument(document).eligibleForTransmission) throw new Error("FISCAL_LEGACY_TRANSMISSION_BLOCKED");
  const request = {
    companyId: input.companyId,
    fiscalDocumentId: input.fiscalDocumentId,
    artifactHash: input.artifactHash,
    idempotencyKey: input.idempotencyKey,
  };
  const requestHash = sha256Hex(canonicalJson(request));
  const existing = await prisma.fiscalTransmission.findUnique({
    where: { companyId_provider_idempotencyKey: { companyId: input.companyId, provider: provider.name, idempotencyKey: input.idempotencyKey } },
  });
  if (existing?.status === "ACKNOWLEDGED" && existing.responsePayload) {
    if (existing.requestHash !== requestHash) throw new Error("FISCAL_TRANSMISSION_IDEMPOTENCY_CONFLICT");
    return { transmissionId: existing.id, receipt: existing.responsePayload as unknown as ProviderReceipt, replayed: true };
  }
  if (existing && existing.requestHash !== requestHash) throw new Error("FISCAL_TRANSMISSION_IDEMPOTENCY_CONFLICT");
  const transmission = existing ?? await prisma.fiscalTransmission.create({
    data: {
      companyId: input.companyId,
      fiscalDocumentId: input.fiscalDocumentId,
      provider: provider.name,
      mode: provider.mode,
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
      requestPayload: json(request),
      requestHash,
    },
  });
  await prisma.fiscalTransmission.update({ where: { id: transmission.id }, data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null } });
  try {
    const receipt = await provider.transmit(request);
    if (receipt.idempotencyKey !== input.idempotencyKey) throw new Error("FISCAL_PROVIDER_IDEMPOTENCY_MISMATCH");
    const responseHash = sha256Hex(canonicalJson(receipt));
    await prisma.fiscalTransmission.update({
      where: { id: transmission.id },
      data: {
        status: "ACKNOWLEDGED",
        responsePayload: json(receipt),
        responseHash,
        providerReference: receipt.reference,
        transmittedAt: new Date(receipt.acceptedAt),
        acknowledgedAt: new Date(receipt.acceptedAt),
      },
    });
    return { transmissionId: transmission.id, receipt, replayed: false };
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120) : "FISCAL_PROVIDER_ERROR";
    await prisma.fiscalTransmission.update({ where: { id: transmission.id }, data: { status: "RETRYING", lastError: code } });
    throw error;
  }
}

export type PublicElectronicInvoiceActivation = {
  enabled: boolean;
  ministerialOrderEffective: boolean;
  independentSchemaApproval: boolean;
  liveCredentialsApproved: boolean;
};

export function assertPublicElectronicInvoiceDeliveryAllowed(activation: PublicElectronicInvoiceActivation) {
  if (!activation.enabled) throw new Error("EINVOICE_PUBLIC_DELIVERY_DISABLED");
  if (!activation.ministerialOrderEffective) throw new Error("EINVOICE_MINISTERIAL_ORDER_NOT_EFFECTIVE");
  if (!activation.independentSchemaApproval) throw new Error("EINVOICE_EXTERNAL_SCHEMA_APPROVAL_REQUIRED");
  if (!activation.liveCredentialsApproved) throw new Error("EINVOICE_LIVE_CREDENTIALS_NOT_APPROVED");
}
