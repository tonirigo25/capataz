export type AppMode = "demo" | "test" | "production";

export function getAppMode(): AppMode {
  const value = process.env.NEXT_PUBLIC_APP_MODE;
  if (value === "test" || value === "production" || value === "demo") return value;
  return process.env.NODE_ENV === "development" ? "test" : "demo";
}

export function isUnlimitedMode(mode: AppMode = getAppMode()) {
  return mode === "test";
}

export function appModeLabel(mode: AppMode = getAppMode()) {
  if (mode === "test") return "Modo pruebas ilimitado";
  if (mode === "production") return "Modo producción";
  return "Estás usando Capataz en modo demo";
}

export function appModeDescription(mode: AppMode = getAppMode()) {
  if (mode === "test") return "Sin límites demo para crear, editar y generar PDFs durante pruebas.";
  if (mode === "production") return "Límites según el plan activo cuando se conecte suscripción real.";
  return "Demo pública con límites comerciales y PDFs marcados como Demo Capataz.";
}
