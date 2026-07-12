type Condition = {
  group: number;
  operator: string;
  field: string;
  comparator: string;
  value: unknown;
};
const read = (data: Record<string, unknown>, path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      data,
    );
const time = (value: unknown) => new Date(String(value)).getTime();

export function evaluateCondition(
  actual: unknown,
  comparator: string,
  expected: unknown,
  now = new Date(),
) {
  switch (comparator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "greater_than":
      return Number(actual) > Number(expected);
    case "greater_or_equal":
      return Number(actual) >= Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
    case "less_or_equal":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual ?? "").includes(String(expected));
    case "not_contains":
      return !String(actual ?? "").includes(String(expected));
    case "is_empty":
      return (
        actual == null ||
        actual === "" ||
        (Array.isArray(actual) && !actual.length)
      );
    case "is_not_empty":
      return (
        actual != null &&
        actual !== "" &&
        (!Array.isArray(actual) || actual.length > 0)
      );
    case "before":
      return time(actual) < time(expected);
    case "after":
      return time(actual) > time(expected);
    case "days_overdue":
      return (
        Math.floor((now.getTime() - time(actual)) / 86400000) >=
        Number(expected)
      );
    case "changed_from":
      return (actual as { previous?: unknown })?.previous === expected;
    case "changed_to":
      return (actual as { current?: unknown })?.current === expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: Condition[],
  context: Record<string, unknown>,
) {
  if (!conditions.length) return true;
  const groups = new Map<number, boolean[]>();
  for (const item of conditions)
    groups.set(item.group, [
      ...(groups.get(item.group) ?? []),
      evaluateCondition(read(context, item.field), item.comparator, item.value),
    ]);
  return [...groups.entries()].every(([group, values]) =>
    conditions.find((item) => item.group === group)?.operator === "or"
      ? values.some(Boolean)
      : values.every(Boolean),
  );
}
