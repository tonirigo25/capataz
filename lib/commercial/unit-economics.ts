export const PUBLIC_PRICING_ENABLED = false as const;

export type UnitEconomicsInput = {
  infrastructureBase: number;
  users: number;
  costPerUser: number;
  storageGb: number;
  costPerStorageGb: number;
  documents: number;
  costPerDocument: number;
  inputTokens: number;
  costPerMillionInputTokens: number;
  outputTokens: number;
  costPerMillionOutputTokens: number;
  transcriptionMinutes: number;
  costPerTranscriptionMinute: number;
  supportHours: number;
  costPerSupportHour: number;
  targetMargin: number;
  contingency: number;
  includedAiActions: number;
};

export function calculateUnitEconomics(input: UnitEconomicsInput) {
  const aiCost =
    (input.inputTokens / 1_000_000) * input.costPerMillionInputTokens +
    (input.outputTokens / 1_000_000) * input.costPerMillionOutputTokens +
    input.transcriptionMinutes * input.costPerTranscriptionMinute;
  const operatingCost =
    input.infrastructureBase +
    input.users * input.costPerUser +
    input.storageGb * input.costPerStorageGb +
    input.documents * input.costPerDocument +
    aiCost +
    input.supportHours * input.costPerSupportHour;
  const estimatedCompanyCost = operatingCost * (1 + input.contingency);
  const priceMinimum = estimatedCompanyCost / Math.max(0.01, 1 - input.targetMargin);
  const estimatedMargin = priceMinimum - estimatedCompanyCost;
  const aiAllowanceCost = input.includedAiActions > 0 ? aiCost / input.includedAiActions : 0;
  const overagePrice = aiAllowanceCost > 0 ? aiAllowanceCost / Math.max(0.01, 1 - input.targetMargin) : 0;
  return {
    aiCost,
    operatingCost,
    estimatedCompanyCost,
    estimatedMargin,
    priceMinimum,
    aiAllowanceCost,
    overagePrice,
  };
}

export const unitEconomicsScenarios: Record<"initial" | "professional" | "business", UnitEconomicsInput> = {
  initial: { infrastructureBase: 18, users: 3, costPerUser: 1.5, storageGb: 2, costPerStorageGb: .12, documents: 250, costPerDocument: .012, inputTokens: 2_000_000, costPerMillionInputTokens: .8, outputTokens: 600_000, costPerMillionOutputTokens: 4, transcriptionMinutes: 0, costPerTranscriptionMinute: .01, supportHours: .5, costPerSupportHour: 24, targetMargin: .65, contingency: .15, includedAiActions: 0 },
  professional: { infrastructureBase: 34, users: 12, costPerUser: 1.5, storageGb: 12, costPerStorageGb: .12, documents: 2500, costPerDocument: .012, inputTokens: 12_000_000, costPerMillionInputTokens: .8, outputTokens: 3_500_000, costPerMillionOutputTokens: 4, transcriptionMinutes: 120, costPerTranscriptionMinute: .01, supportHours: 1.5, costPerSupportHour: 24, targetMargin: .68, contingency: .18, includedAiActions: 500 },
  business: { infrastructureBase: 72, users: 50, costPerUser: 1.5, storageGb: 100, costPerStorageGb: .12, documents: 20000, costPerDocument: .012, inputTokens: 60_000_000, costPerMillionInputTokens: .8, outputTokens: 18_000_000, costPerMillionOutputTokens: 4, transcriptionMinutes: 800, costPerTranscriptionMinute: .01, supportHours: 5, costPerSupportHour: 24, targetMargin: .7, contingency: .2, includedAiActions: 5000 },
};
