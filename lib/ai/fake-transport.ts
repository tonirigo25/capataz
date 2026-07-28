import {
  AiTransportError,
  type AiTransport,
  type AiTransportInput,
  type AiTransportResult,
  type JsonValue,
  type StrictJsonSchema,
} from "@/lib/ai/contracts";
import { hashJson } from "@/lib/ai/redaction";

type FakeStep =
  | { type: "result"; output: JsonValue; inputTokens?: number; outputTokens?: number; costEur?: number }
  | { type: "error"; code: string; retryable: boolean; status?: number }
  | { type: "empty" }
  | { type: "hang-until-abort" };

function fixtureForSchema(schema: StrictJsonSchema): JsonValue {
  const type = Array.isArray(schema.type) ? schema.type.find((candidate) => candidate !== "null") ?? "null" : schema.type;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (type === "object") return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, child]) => [key, fixtureForSchema(child)]));
  if (type === "array") return schema.minItems ? Array.from({ length: schema.minItems }, () => fixtureForSchema(schema.items ?? {})) : [];
  if (type === "string") return "synthetic-result";
  if (type === "number" || type === "integer") return schema.minimum ?? 0;
  if (type === "boolean") return false;
  return null;
}

export class FakeGovernedAiTransport implements AiTransport {
  readonly name = "fake-ai-governed";
  readonly mode = "fake" as const;
  readonly calls: AiTransportInput[] = [];
  private index = 0;

  constructor(private readonly steps: FakeStep[] = []) {}

  async complete(input: AiTransportInput): Promise<AiTransportResult> {
    if (input.store !== false) throw new AiTransportError("AI_STORE_MUST_BE_FALSE", { retryable: false });
    this.calls.push(input);
    const step = this.steps[Math.min(this.index++, Math.max(0, this.steps.length - 1))];
    if (step?.type === "error") throw new AiTransportError(step.code, { retryable: step.retryable, status: step.status });
    if (step?.type === "hang-until-abort") {
      await new Promise<never>((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (input.signal.aborted) abort();
        else input.signal.addEventListener("abort", abort, { once: true });
      });
    }
    if (step?.type === "empty") return {
      provider: this.name,
      model: input.model,
      modelSnapshot: input.modelSnapshot,
      output: null,
      usageIsSyntheticOrEstimated: true,
    };
    const output = step?.type === "result" ? step.output : fixtureForSchema(input.outputSchema);
    const inputTokens = step?.type === "result" && step.inputTokens !== undefined
      ? step.inputTokens
      : Math.ceil(Buffer.byteLength(JSON.stringify(input.payload)) / 4);
    const outputTokens = step?.type === "result" && step.outputTokens !== undefined
      ? step.outputTokens
      : Math.ceil(Buffer.byteLength(JSON.stringify(output)) / 4);
    const rate = input.lane === "fast" ? { input: 0.5, output: 1.5 } : { input: 2, output: 8 };
    return {
      provider: this.name,
      providerReference: `fake-${hashJson({ index: this.calls.length, idempotencyKey: input.idempotencyKey }).slice(0, 20)}`,
      model: input.model,
      modelSnapshot: input.modelSnapshot,
      output,
      inputTokens,
      outputTokens,
      estimatedCostEur: step?.type === "result" && step.costEur !== undefined
        ? step.costEur
        : (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000,
      usageIsSyntheticOrEstimated: true,
    };
  }
}
