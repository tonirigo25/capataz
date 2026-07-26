import { createHash, sign, type KeyObject } from "node:crypto";

export type FiscalSignature = {
  adapter: string;
  algorithm: "RSA-SHA256" | "ECDSA-SHA256" | "FAKE-SHA256";
  keyVersion: string;
  credentialReference: string;
  certificateFingerprint: string;
  signatureBase64: string;
  signedAt: string;
};

export interface FiscalSignatureAdapter {
  readonly name: string;
  sign(input: {
    bytes: Uint8Array;
    credentialReference: string;
    keyVersion: string;
    signedAt: string;
  }): Promise<FiscalSignature>;
}

function reference(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || /BEGIN (?:PRIVATE KEY|CERTIFICATE)|\s/u.test(normalized)) {
    throw new Error(`FISCAL_SIGNATURE_REFERENCE_INVALID:${field}`);
  }
  return normalized;
}

export class FakeFiscalSignatureAdapter implements FiscalSignatureAdapter {
  readonly name = "fake-fiscal-signature";

  async sign(input: { bytes: Uint8Array; credentialReference: string; keyVersion: string; signedAt: string }) {
    const credentialReference = reference(input.credentialReference, "credentialReference");
    const keyVersion = reference(input.keyVersion, "keyVersion");
    const digest = createHash("sha256")
      .update(input.bytes)
      .update(credentialReference)
      .update(keyVersion)
      .digest();
    return {
      adapter: this.name,
      algorithm: "FAKE-SHA256" as const,
      keyVersion,
      credentialReference,
      certificateFingerprint: createHash("sha256").update(`fake:${credentialReference}:${keyVersion}`).digest("hex"),
      signatureBase64: digest.toString("base64"),
      signedAt: input.signedAt,
    };
  }
}

export class NodeKeyFiscalSignatureAdapter implements FiscalSignatureAdapter {
  readonly name = "node-key-fiscal-signature";

  constructor(
    private readonly privateKey: KeyObject,
    private readonly certificateFingerprint: string,
    private readonly algorithm: "RSA-SHA256" | "ECDSA-SHA256",
  ) {
    if (privateKey.type !== "private") throw new Error("FISCAL_PRIVATE_KEY_REQUIRED");
    if (!/^[a-f0-9]{64}$/iu.test(certificateFingerprint)) throw new Error("FISCAL_CERTIFICATE_FINGERPRINT_INVALID");
  }

  async sign(input: { bytes: Uint8Array; credentialReference: string; keyVersion: string; signedAt: string }) {
    const credentialReference = reference(input.credentialReference, "credentialReference");
    const keyVersion = reference(input.keyVersion, "keyVersion");
    const signature = sign("sha256", input.bytes, this.privateKey);
    return {
      adapter: this.name,
      algorithm: this.algorithm,
      keyVersion,
      credentialReference,
      certificateFingerprint: this.certificateFingerprint.toLowerCase(),
      signatureBase64: signature.toString("base64"),
      signedAt: input.signedAt,
    };
  }
}
