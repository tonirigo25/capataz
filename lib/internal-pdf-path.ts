const INTERNAL_PDF_PATH_PATTERN =
  /^\/(?!\/)[A-Za-z0-9][A-Za-z0-9/_-]*\/pdf(?:\?preview=1)?$/u;

export function sanitizeInternalPdfPath(value: string) {
  if (!INTERNAL_PDF_PATH_PATTERN.test(value)) return null;

  const base = new URL("https://orqena.invalid");
  const parsed = new URL(value, base);
  if (parsed.origin !== base.origin || parsed.hash) return null;
  return `${parsed.pathname}${parsed.search}`;
}

export function extractInternalPdfPreviewPath(text: string) {
  const candidate = text.match(/\/[^\s]+?\/pdf\?preview=1/u)?.[0];
  return candidate ? sanitizeInternalPdfPath(candidate) : null;
}
