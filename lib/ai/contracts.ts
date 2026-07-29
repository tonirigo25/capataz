export type AiLane = "fast" | "reasoning" | "transcription";
export type AiClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type StrictJsonSchema = {
  type?: string | string[];
  enum?: JsonPrimitive[];
  const?: JsonPrimitive;
  properties?: Record<string, StrictJsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: StrictJsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
};

export type AiCorrelation = {
  requestId: string;
  correlationId: string;
  causationId?: string;
};

export type GovernedAiRequest = AiCorrelation & {
  companyId: string;
  actorId: string;
  role: string;
  scopes: string[];
  purpose: string;
  classification: AiClassification;
  operationKey: string;
  idempotencyKey: string;
  lane: AiLane;
  promptVersion: string;
  trustedInstruction?: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  outputSchema: StrictJsonSchema;
  maxOutputTokens: number;
  estimatedCostCeilingEur: number;
  sensitiveEffect?: {
    type: string;
    entityType: string;
    entityId: string;
    destination: string;
    confirmation?: string;
  };
};

export type AiTransportInput = {
  model: string;
  modelSnapshot: string;
  lane: AiLane;
  purpose: string;
  promptVersion: string;
  trustedInstruction?: string;
  schemaVersion: number;
  payload: JsonValue;
  outputSchema: StrictJsonSchema;
  maxOutputTokens: number;
  store: false;
  idempotencyKey: string;
  metadata: Record<string, string>;
  signal: AbortSignal;
};

export type AiTransportResult = {
  provider: string;
  providerReference?: string;
  model: string;
  modelSnapshot: string;
  output: JsonValue;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostEur?: number;
  usageIsSyntheticOrEstimated: boolean;
};

export interface AiTransport {
  readonly name: string;
  readonly mode: "fake" | "live";
  complete(input: AiTransportInput): Promise<AiTransportResult>;
}

export type AiGatewayResponse = {
  status: "COMPLETED" | "DEGRADED" | "REQUIRES_CONFIRMATION";
  source: "fake" | "openai" | "deterministic-fallback" | "idempotent-replay";
  output: JsonValue;
  reviewRequired: boolean;
  schemaVersion: number;
  usageEventId?: string;
  replayed?: boolean;
  reasonCode?: string;
};

export class AiGatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string = code,
    public readonly retryable = false,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export class AiTransportError extends AiGatewayError {
  constructor(code: string, options: { retryable: boolean; status?: number; cause?: unknown }) {
    super(code, code, options.retryable, options.status);
    this.name = "AiTransportError";
    if (options.cause !== undefined) this.cause = options.cause;
  }
}
