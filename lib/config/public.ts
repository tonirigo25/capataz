import { readAppEnvironment } from "./environment";

export function getPublicConfig(env: NodeJS.ProcessEnv = process.env) {
  const appEnvironment = readAppEnvironment(env.NEXT_PUBLIC_APP_ENV ?? env.APP_ENV);
  const registration = env.ORQENA_PUBLIC_REGISTRATION_ENABLED?.trim().toLowerCase();
  return Object.freeze({
    environment: appEnvironment,
    appMode: env.NEXT_PUBLIC_APP_MODE?.trim() || "test",
    baseUrl: env.NEXT_PUBLIC_WEB_BASE_URL?.trim() || "http://localhost:3000",
    supportEmail: env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "soporte@orqena.invalid",
    consentMode: env.NEXT_PUBLIC_CONSENT_MODE?.trim() || "essential-only",
    publicRegistrationEnabled:
      appEnvironment !== "staging"
      && (registration === "true" || (registration !== "false" && appEnvironment !== "production")),
    publicIndexingEnabled: env.PUBLIC_INDEXING_ENABLED === "true",
  });
}

export const publicConfig = getPublicConfig();

export type PublicConfig = ReturnType<typeof getPublicConfig>;
