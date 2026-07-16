import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export type StoredDocument = { storageKey: string; sizeBytes: number };

export interface DocumentStorage {
  put(input: { companyId: string; bytes: Buffer; extension: string }): Promise<StoredDocument>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export function documentStorageRoot() {
  return resolve(process.env.DOCUMENT_STORAGE_ROOT || join(process.cwd(), ".capataz-documents"));
}

export class LocalDocumentStorage implements DocumentStorage {
  constructor(private readonly root = documentStorageRoot()) {}

  async put({ companyId, bytes, extension }: { companyId: string; bytes: Buffer; extension: string }) {
    const safeCompany = safeSegment(companyId);
    const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
    const storageKey = `${safeCompany}/${randomUUID()}.${safeExtension}`;
    const target = this.resolveKey(storageKey);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return { storageKey, sizeBytes: bytes.length };
  }

  async get(storageKey: string) {
    return readFile(this.resolveKey(storageKey));
  }

  async delete(storageKey: string) {
    await rm(this.resolveKey(storageKey), { force: true });
  }

  private resolveKey(storageKey: string) {
    if (!storageKey || isAbsolute(storageKey) || storageKey.includes("\0")) throw new Error("Invalid storage key");
    const target = resolve(this.root, storageKey);
    const offset = relative(this.root, target);
    if (!offset || offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new Error("Invalid storage key");
    return target;
  }
}

function safeSegment(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("Invalid company identifier");
  return safe;
}

export const documentStorage: DocumentStorage = new LocalDocumentStorage();
