const AUTH_ENTRY_PATHS = ["/login", "/registro", "/recuperar-contrasena", "/restablecer-contrasena"];

export function normalizeLoginReturnPath(value: string) {
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "/hoy";

  try {
    const parsed = new URL(candidate, "https://app.orqenatech.com");
    if (parsed.origin !== "https://app.orqenatech.com") return "/hoy";
    if (AUTH_ENTRY_PATHS.some((path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))) return "/hoy";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/hoy";
  }
}
