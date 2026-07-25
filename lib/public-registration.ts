export function isPublicRegistrationEnabled() {
  if (process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() === "staging") return false;
  const configured = process.env.ORQENA_PUBLIC_REGISTRATION_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NEXT_PUBLIC_APP_ENV !== "production";
}
