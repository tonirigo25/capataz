import { AiGatewayError, type JsonValue, type StrictJsonSchema } from "@/lib/ai/contracts";

function types(schema: StrictJsonSchema): string[] {
  if (!schema.type) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function jsonType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

export function assertStrictJsonSchema(schema: StrictJsonSchema, path = "$schema"): void {
  const allowed = new Set(["string", "number", "integer", "boolean", "null", "object", "array"]);
  for (const type of types(schema)) if (!allowed.has(type)) throw new AiGatewayError("AI_SCHEMA_UNSUPPORTED", `${path}.type`);
  if (types(schema).includes("object")) {
    if (schema.additionalProperties !== false) throw new AiGatewayError("AI_SCHEMA_NOT_STRICT", `${path}.additionalProperties`);
    const propertyNames = Object.keys(schema.properties ?? {});
    const required = new Set(schema.required ?? []);
    if (propertyNames.some((name) => !required.has(name)) || [...required].some((name) => !propertyNames.includes(name))) {
      throw new AiGatewayError("AI_SCHEMA_NOT_STRICT", `${path}.required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) assertStrictJsonSchema(child, `${path}.properties.${key}`);
  }
  if (types(schema).includes("array")) {
    if (!schema.items) throw new AiGatewayError("AI_SCHEMA_NOT_STRICT", `${path}.items`);
    assertStrictJsonSchema(schema.items, `${path}.items`);
  }
}

export function validateJsonSchema(value: JsonValue, schema: StrictJsonSchema, path = "$output"): void {
  const expected = types(schema);
  const actual = jsonType(value);
  if (expected.length && !expected.includes(actual) && !(actual === "number" && expected.includes("integer") && Number.isInteger(value))) {
    throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: expected ${expected.join("|")}, received ${actual}`);
  }
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: enum`);
  if (schema.const !== undefined && !Object.is(schema.const, value)) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: const`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: minLength`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: maxLength`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: minItems`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}: maxItems`);
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items!, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, JsonValue>;
    for (const key of schema.required ?? []) if (!(key in record)) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}.${key}: required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) if (!schema.properties?.[key]) throw new AiGatewayError("AI_OUTPUT_SCHEMA_INVALID", `${path}.${key}: additional`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in record) validateJsonSchema(record[key], child, `${path}.${key}`);
  }
}
