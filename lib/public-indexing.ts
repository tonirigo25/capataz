import type { Metadata } from "next";

export const X_ROBOTS_TAG_VALUE = "noindex, nofollow, noarchive, nosnippet";

export const PRIVATE_ROBOTS_METADATA = {
  index: false,
  follow: false,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
  googleBot: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
} satisfies Metadata["robots"];

const PUBLIC_INDEXABLE_EXACT_PATHS = new Set([
  "/",
  "/producto",
  "/soluciones",
  "/sectores",
  "/planes",
  "/seguridad",
  "/demo",
  "/contacto",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/soporte",
]);

export const PUBLIC_ROBOTS_ALLOW_PATHS = [
  "/$",
  "/producto",
  "/soluciones",
  "/sectores",
  "/planes",
  "/seguridad",
  "/demo",
  "/contacto",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/soporte",
] as const;

export function isPublicIndexingEnabled(): boolean {
  try {
    return process.env.PUBLIC_INDEXING_ENABLED === "true";
  } catch {
    return false;
  }
}

export function isPublicIndexablePath(pathname: string): boolean {
  return PUBLIC_INDEXABLE_EXACT_PATHS.has(pathname)
    || pathname.startsWith("/producto/")
    || pathname.startsWith("/sectores/");
}

export function shouldSendNoIndexHeader(
  pathname: string,
  indexingEnabled = isPublicIndexingEnabled(),
): boolean {
  return !indexingEnabled || !isPublicIndexablePath(pathname);
}

export function getPublicRobotsMetadata(): Metadata["robots"] {
  if (!isPublicIndexingEnabled()) return PRIVATE_ROBOTS_METADATA;
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  };
}
