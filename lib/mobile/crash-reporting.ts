import { createHash } from "node:crypto";

export type MobileCrashPlatform = "android" | "ios" | "webview";

export type MobileCrashEvent = Readonly<{
  version: 1;
  eventId: string;
  occurredAt: string;
  platform: MobileCrashPlatform;
  environment: "development" | "staging" | "release";
  releaseSha: string;
  code: string;
  fingerprint: string;
  synthetic: boolean;
}>;

export type MobileCrashTransport = { send(event: MobileCrashEvent): Promise<{ accepted: boolean; reference: string }> };

export function createMobileCrashEvent(input: {
  eventId: string;
  occurredAt: Date;
  platform: MobileCrashPlatform;
  environment: MobileCrashEvent["environment"];
  releaseSha: string;
  code: string;
  synthetic?: boolean;
  [key: string]: unknown;
}): MobileCrashEvent {
  const forbidden = ["message", "stack", "email", "phone", "name", "userId", "companyId", "url", "route", "payload", "token", "secret", "prompt"];
  for (const key of forbidden) if (key in input) throw new Error(`MOBILE_CRASH_FIELD_FORBIDDEN:${key}`);
  if (!/^[a-zA-Z0-9:_-]{8,96}$/.test(input.eventId)) throw new Error("MOBILE_CRASH_EVENT_ID_INVALID");
  if (!/^[0-9a-f]{7,40}$/i.test(input.releaseSha)) throw new Error("MOBILE_CRASH_RELEASE_INVALID");
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(input.code)) throw new Error("MOBILE_CRASH_CODE_INVALID");
  const fingerprint = createHash("sha256").update(`${input.platform}|${input.environment}|${input.releaseSha}|${input.code}`).digest("hex");
  return Object.freeze({ version: 1, eventId: input.eventId, occurredAt: input.occurredAt.toISOString(), platform: input.platform, environment: input.environment, releaseSha: input.releaseSha, code: input.code, fingerprint, synthetic: input.synthetic === true });
}

export async function sendSyntheticMobileCrash(transport: MobileCrashTransport, input: {
  eventId: string;
  occurredAt: Date;
  platform: MobileCrashPlatform;
  environment: MobileCrashEvent["environment"];
  releaseSha: string;
  code: string;
}) {
  return transport.send(createMobileCrashEvent({ ...input, synthetic: true }));
}
