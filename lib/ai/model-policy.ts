import { AiGatewayError, type AiLane } from "@/lib/ai/contracts";

export type ResolvedAiModel = {
  lane: AiLane;
  logicalModel: string;
  providerModel: string;
  modelSnapshot: string;
  maxAttempts: number;
};

export function resolveAiModel(input: {
  lane: AiLane;
  approvedModels: string[];
  environment?: NodeJS.ProcessEnv;
  live: boolean;
}): ResolvedAiModel {
  const env = input.environment ?? process.env;
  const fast = env.OPENAI_MODEL_FAST?.trim() || "gpt-4.1-mini";
  const reasoning = env.OPENAI_MODEL_REASONING?.trim() || "gpt-5.5";
  const model = input.lane === "fast" ? fast : reasoning;
  if (!input.approvedModels.includes(model)) throw new AiGatewayError("AI_MODEL_NOT_APPROVED");
  const snapshotKey = input.lane === "fast" ? "OPENAI_MODEL_FAST_SNAPSHOT" : "OPENAI_MODEL_REASONING_SNAPSHOT";
  const snapshot = env[snapshotKey]?.trim();
  if (input.live && !snapshot) throw new AiGatewayError("AI_MODEL_SNAPSHOT_REQUIRED_FOR_LIVE");
  return {
    lane: input.lane,
    logicalModel: input.lane === "fast" ? "orqena-fast-v1" : "orqena-reasoning-v1",
    providerModel: model,
    modelSnapshot: snapshot || `synthetic-${input.lane}-v1`,
    maxAttempts: input.lane === "fast" ? 3 : 2,
  };
}

export function shouldEscalateToReasoning(input: { lane: AiLane; ambiguityScore?: number; requested?: boolean }): boolean {
  return input.lane === "fast" && (input.requested === true || (input.ambiguityScore ?? 0) >= 0.7);
}
