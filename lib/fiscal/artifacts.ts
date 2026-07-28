import type { Prisma, PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@/lib/platform/providers/contracts";
import { canonicalJson, sha256Hex, type CanonicalInvoice } from "./canonical";
import { generateElectronicInvoice, type ElectronicInvoiceFormat } from "./electronic-invoice";
import type { FiscalSignatureAdapter } from "./signatures";
import { assertPublicElectronicInvoiceDeliveryAllowed, type PublicElectronicInvoiceActivation } from "./transmission";

export type ElectronicInvoiceDeliveryChannel = "DOWNLOAD" | "SECURE_EMAIL" | "PRIVATE_EXCHANGE" | "PUBLIC_SOLUTION";
export type ElectronicInvoiceBusinessStatus = "ACCEPTED" | "REJECTED" | "PAYMENT_FULL" | "PAYMENT_PARTIAL" | "PAYMENT_DATE";

export interface ElectronicInvoiceDeliveryAdapter {
  readonly name: string;
  readonly channel: ElectronicInvoiceDeliveryChannel;
  deliver(input: { companyId: string; artifactId: string; storageKey: string; contentHash: string; recipient: string; idempotencyKey: string }): Promise<{
    providerReference: string;
    acknowledgedAt: string;
    response: Record<string, string>;
  }>;
}

export class FakeElectronicInvoiceDeliveryAdapter implements ElectronicInvoiceDeliveryAdapter {
  readonly name = "fake-electronic-invoice-delivery";
  attempts = 0;
  constructor(readonly channel: ElectronicInvoiceDeliveryChannel) {}
  async deliver(input: { companyId: string; artifactId: string; storageKey: string; contentHash: string; recipient: string; idempotencyKey: string }) {
    this.attempts += 1;
    return {
      providerReference: sha256Hex(`${this.name}:${this.channel}:${input.idempotencyKey}`).slice(0, 24),
      acknowledgedAt: "1970-01-01T00:00:00.000Z",
      response: { adapter: this.name, channel: this.channel, accepted: "true" },
    };
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function statusEventHash(input: { sequence: number; previousHash: string | null; eventType: string; occurredAt: Date; payload: unknown }) {
  return sha256Hex(canonicalJson({ ...input, occurredAt: input.occurredAt.toISOString() }));
}

async function appendStatusEvent(transaction: Prisma.TransactionClient, input: {
  companyId: string;
  artifactId: string;
  eventType: string;
  payload: unknown;
  occurredAt?: Date;
}) {
  const prior = await transaction.electronicInvoiceStatusEvent.findFirst({ where: { artifactId: input.artifactId }, orderBy: { sequence: "desc" } });
  const sequence = (prior?.sequence ?? 0) + 1;
  const occurredAt = input.occurredAt ?? new Date();
  const payload = json(input.payload);
  return transaction.electronicInvoiceStatusEvent.create({
    data: {
      companyId: input.companyId,
      artifactId: input.artifactId,
      eventType: input.eventType,
      payload,
      sequence,
      previousHash: prior?.eventHash,
      eventHash: statusEventHash({ sequence, previousHash: prior?.eventHash ?? null, eventType: input.eventType, occurredAt, payload: input.payload }),
      occurredAt,
    },
  });
}

export async function generateAndStoreElectronicInvoice(prisma: PrismaClient, input: {
  companyId: string;
  fiscalDocumentId: string;
  format: ElectronicInvoiceFormat;
  storage: StorageProvider;
  signer?: FiscalSignatureAdapter;
  credentialReference?: string;
  keyVersion?: string;
  retentionUntil?: Date;
}) {
  const document = await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: input.fiscalDocumentId } });
  if (document.companyId !== input.companyId) throw new Error("EINVOICE_CROSS_TENANT_DOCUMENT");
  if (document.status !== "ISSUED") throw new Error("EINVOICE_DOCUMENT_NOT_ISSUED");
  const invoice = document.sourceSnapshot as unknown as CanonicalInvoice;
  const generated = await generateElectronicInvoice(invoice, input.format, {
    signer: input.signer,
    credentialReference: input.credentialReference,
    keyVersion: input.keyVersion,
  });
  const objectKey = `fiscal/${document.id}/${input.format.toLowerCase()}-${generated.contentHash}.dat`;
  const receipt = await input.storage.put({
    companyId: input.companyId,
    objectKey,
    bytes: generated.bytes,
    contentType: generated.mimeType,
    idempotencyKey: `einvoice-artifact:${document.id}:${input.format}:${generated.contentHash}`,
  });
  if (receipt.sha256 !== generated.contentHash) throw new Error("EINVOICE_STORAGE_HASH_MISMATCH");
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.electronicInvoiceArtifact.findUnique({
      where: { fiscalDocumentId_format_schemaVersion: { fiscalDocumentId: document.id, format: input.format, schemaVersion: generated.schemaVersion } },
    });
    if (existing) {
      if (existing.contentHash !== generated.contentHash || existing.semanticHash !== generated.semanticHash) throw new Error("EINVOICE_ARTIFACT_VERSION_CONFLICT");
      return { artifact: existing, generated, replayed: true };
    }
    const artifact = await transaction.electronicInvoiceArtifact.create({
      data: {
        companyId: input.companyId,
        fiscalDocumentId: document.id,
        format: input.format,
        schemaVersion: generated.schemaVersion,
        semanticVersion: generated.semanticVersion,
        validatorVersion: generated.validatorVersion,
        contentHash: generated.contentHash,
        semanticHash: generated.semanticHash,
        storageKey: objectKey,
        mimeType: generated.mimeType,
        signatureProfile: generated.signature?.algorithm,
        signedAt: generated.signature ? new Date(generated.signature.signedAt) : undefined,
        retentionUntil: input.retentionUntil,
        status: "GENERATED",
      },
    });
    await appendStatusEvent(transaction, { companyId: input.companyId, artifactId: artifact.id, eventType: "GENERATED", payload: { contentHash: generated.contentHash, semanticHash: generated.semanticHash } });
    return { artifact, generated, replayed: false };
  });
}

export async function recordElectronicInvoiceDelivery(prisma: PrismaClient, input: {
  companyId: string;
  artifactId: string;
  channel: ElectronicInvoiceDeliveryChannel;
  recipient: string;
  idempotencyKey: string;
  providerReference: string;
  publicActivation?: PublicElectronicInvoiceActivation;
}) {
  if (input.channel === "PUBLIC_SOLUTION") {
    assertPublicElectronicInvoiceDeliveryAllowed(input.publicActivation ?? {
      enabled: false,
      ministerialOrderEffective: false,
      independentSchemaApproval: false,
      liveCredentialsApproved: false,
    });
  }
  const artifact = await prisma.electronicInvoiceArtifact.findUniqueOrThrow({ where: { id: input.artifactId } });
  if (artifact.companyId !== input.companyId) throw new Error("EINVOICE_CROSS_TENANT_ARTIFACT");
  const recipientHash = sha256Hex(input.recipient.trim().toLowerCase());
  const response = { providerReference: input.providerReference, channel: input.channel };
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.electronicInvoiceDelivery.findUnique({
      where: { companyId_channel_idempotencyKey: { companyId: input.companyId, channel: input.channel, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.artifactId !== artifact.id || existing.recipientHash !== recipientHash) throw new Error("EINVOICE_DELIVERY_IDEMPOTENCY_CONFLICT");
      return { delivery: existing, replayed: true };
    }
    const occurredAt = new Date();
    const delivery = await transaction.electronicInvoiceDelivery.create({
      data: {
        companyId: input.companyId,
        artifactId: artifact.id,
        channel: input.channel,
        recipient: "redacted",
        recipientHash,
        idempotencyKey: input.idempotencyKey,
        status: "ACKNOWLEDGED",
        attempts: 1,
        deliveredAt: occurredAt,
        acknowledgedAt: occurredAt,
        providerReference: input.providerReference,
        responseHash: sha256Hex(canonicalJson(response)),
      },
    });
    await appendStatusEvent(transaction, { companyId: input.companyId, artifactId: artifact.id, eventType: "DELIVERY_ACKNOWLEDGED", payload: { channel: input.channel, recipientHash, providerReference: input.providerReference }, occurredAt });
    return { delivery, replayed: false };
  });
}

export const electronicInvoiceStatusEventHash = statusEventHash;

export async function deliverElectronicInvoice(prisma: PrismaClient, input: {
  companyId: string;
  artifactId: string;
  recipient: string;
  idempotencyKey: string;
  adapter: ElectronicInvoiceDeliveryAdapter;
  publicActivation?: PublicElectronicInvoiceActivation;
}) {
  if (input.adapter.channel === "PUBLIC_SOLUTION") {
    assertPublicElectronicInvoiceDeliveryAllowed(input.publicActivation ?? {
      enabled: false,
      ministerialOrderEffective: false,
      independentSchemaApproval: false,
      liveCredentialsApproved: false,
    });
  }
  const artifact = await prisma.electronicInvoiceArtifact.findUniqueOrThrow({ where: { id: input.artifactId } });
  if (artifact.companyId !== input.companyId) throw new Error("EINVOICE_CROSS_TENANT_ARTIFACT");
  const recipientHash = sha256Hex(input.recipient.trim().toLowerCase());
  const existing = await prisma.electronicInvoiceDelivery.findUnique({
    where: { companyId_channel_idempotencyKey: { companyId: input.companyId, channel: input.adapter.channel, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) {
    if (existing.artifactId !== artifact.id || existing.recipientHash !== recipientHash) throw new Error("EINVOICE_DELIVERY_IDEMPOTENCY_CONFLICT");
    return { delivery: existing, replayed: true, receipt: null };
  }
  const receipt = await input.adapter.deliver({
    companyId: input.companyId,
    artifactId: artifact.id,
    storageKey: artifact.storageKey,
    contentHash: artifact.contentHash,
    recipient: input.recipient,
    idempotencyKey: input.idempotencyKey,
  });
  const result = await recordElectronicInvoiceDelivery(prisma, {
    companyId: input.companyId,
    artifactId: artifact.id,
    channel: input.adapter.channel,
    recipient: input.recipient,
    idempotencyKey: input.idempotencyKey,
    providerReference: receipt.providerReference,
    publicActivation: input.publicActivation,
  });
  return { ...result, receipt };
}

export async function recordElectronicInvoiceBusinessStatus(prisma: PrismaClient, input: {
  companyId: string;
  artifactId: string;
  eventType: ElectronicInvoiceBusinessStatus;
  effectiveAt: Date;
  reasonCode?: string;
  amount?: string;
}) {
  if (!Number.isFinite(input.effectiveAt.getTime())) throw new Error("EINVOICE_STATUS_DATE_INVALID");
  if (input.eventType === "REJECTED" && !input.reasonCode?.trim()) throw new Error("EINVOICE_REJECTION_REASON_REQUIRED");
  if (input.eventType === "PAYMENT_PARTIAL" && !input.amount?.trim()) throw new Error("EINVOICE_PARTIAL_PAYMENT_AMOUNT_REQUIRED");
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`einvoice-status:${input.artifactId}`}, 0))`;
    const artifact = await transaction.electronicInvoiceArtifact.findUniqueOrThrow({ where: { id: input.artifactId } });
    if (artifact.companyId !== input.companyId) throw new Error("EINVOICE_CROSS_TENANT_ARTIFACT");
    const status = input.eventType === "PAYMENT_FULL" ? "PAID" : input.eventType;
    const event = await appendStatusEvent(transaction, {
      companyId: input.companyId,
      artifactId: artifact.id,
      eventType: input.eventType,
      payload: { effectiveAt: input.effectiveAt.toISOString(), reasonCode: input.reasonCode ?? null, amount: input.amount ?? null },
      occurredAt: input.effectiveAt,
    });
    await transaction.electronicInvoiceArtifact.update({ where: { id: artifact.id }, data: { status } });
    return event;
  });
}
