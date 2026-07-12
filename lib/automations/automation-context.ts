export function sanitizeAutomationData(value: unknown): unknown {
  if (Array.isArray(value))
    return value.slice(0, 50).map(sanitizeAutomationData);
  if (!value || typeof value !== "object")
    return typeof value === "string" ? value.slice(0, 1000) : value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) => !/(secret|token|password|key|authorization)/i.test(key),
      )
      .map(([key, item]) => [key, sanitizeAutomationData(item)]),
  );
}
