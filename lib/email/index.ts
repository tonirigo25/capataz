import { FakeEmailProvider } from "@/lib/platform/providers/fake";
import { ResendEmailProvider } from "@/lib/platform/providers/production";
import type { EmailDeliveryProvider } from "@/lib/platform/providers/contracts";
import { Resend } from "resend";

export function getEmailProviderStatus() {
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend" as const;
  if (process.env.EMAIL_PROVIDER === "local" || process.env.NODE_ENV !== "production") return "local" as const;
  return "missing" as const;
}

export function getEmailDeliveryProvider(): EmailDeliveryProvider {
  const status = getEmailProviderStatus();
  if (status === "resend") return new ResendEmailProvider(new Resend(process.env.RESEND_API_KEY!), process.env.EMAIL_FROM!);
  if (status === "local") return new FakeEmailProvider();
  throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
}

/** @deprecated Use queueEmailEvent so delivery is transactionally coupled to the business event. */
export async function sendVerificationEmail(to: string, token: string) {
  return getEmailDeliveryProvider().send({ recipient: to, subject: "Verifica tu correo en Orqena", text: `${appUrl("/verificar-email", token)}`, idempotencyKey: `legacy-verification:${token.slice(0, 12)}` });
}

/** @deprecated Use queueEmailEvent so delivery is transactionally coupled to the business event. */
export async function sendPasswordResetEmail(to: string, token: string) {
  return getEmailDeliveryProvider().send({ recipient: to, subject: "Restablece tu contraseña de Orqena", text: `${appUrl("/restablecer-contrasena", token)}`, idempotencyKey: `legacy-reset:${token.slice(0, 12)}` });
}

function appUrl(path: string, token: string) {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!base) throw new Error("APP_BASE_URL_NOT_CONFIGURED");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}
