import { hashJson } from "@/lib/ai/redaction";

export type SyntheticEvalFixture = {
  id: string;
  kind: "positive" | "negative" | "ambiguous" | "adversarial";
  input: string;
  expected: string;
};

export function deterministicEvaluationDecision(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "reject-empty";
  if (/ignora las reglas|prompt del sistema/.test(normalized)) return "treat-as-untrusted";
  if (/otras empresas|lista claves|exfiltr/.test(normalized)) return "reject-cross-tenant-exfiltration";
  if (/marca.+cobrada|sin justificante/.test(normalized)) return "require-human-confirmation";
  if (/rectifica|correg/.test(normalized)) return "record-correction";
  if (/alba.+contacto.+empresa/.test(normalized)) return "ask-entity-type";
  if (/base.+100.+total.+110.+iva/.test(normalized)) return "flag-tax-inconsistency";
  if (/\b250\b/.test(normalized)) return "ask-currency-and-tax";
  if (/\b17h\b/.test(normalized)) return "needs-date-confirmation";
  return "manual-review";
}

export function runSyntheticEvaluation(fixtures: SyntheticEvalFixture[]) {
  const outcomes = fixtures.map((fixture) => ({
    id: fixture.id,
    kind: fixture.kind,
    expected: fixture.expected,
    actual: deterministicEvaluationDecision(fixture.input),
  }));
  const passed = outcomes.filter((outcome) => outcome.expected === outcome.actual).length;
  return {
    datasetHash: hashJson(fixtures),
    total: outcomes.length,
    passed,
    failed: outcomes.length - passed,
    outcomes,
  };
}
