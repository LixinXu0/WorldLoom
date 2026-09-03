import type { IntentEffects } from "../core/intent/types";

export type AIIntentOutput = {
  interpretations: Array<{
    sourceStrokeIds: string[];
    semanticSummary: string;
    confidence: number;
    effects: IntentEffects;
    alternatives?: Array<{
      label: string;
      semanticSummary: string;
      effects: IntentEffects;
    }>;
    conflict?: string;
  }>;
};

export const aiIntentSchema = {
  type: "object",
  required: ["interpretations"],
  properties: {
    interpretations: {
      type: "array",
      items: {
        type: "object",
        required: ["sourceStrokeIds", "semanticSummary", "confidence", "effects"],
        properties: {
          sourceStrokeIds: { type: "array", items: { type: "string" } },
          semanticSummary: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          effects: { type: "object" },
          alternatives: { type: "array" },
          conflict: { type: "string" },
        },
      },
    },
  },
};

export function validateAIIntentOutput(output: unknown): output is AIIntentOutput {
  if (!output || typeof output !== "object") return false;
  const interpretations = (output as AIIntentOutput).interpretations;
  if (!Array.isArray(interpretations)) return false;
  return interpretations.every((interpretation) => Array.isArray(interpretation.sourceStrokeIds) && typeof interpretation.semanticSummary === "string" && typeof interpretation.confidence === "number" && interpretation.effects && typeof interpretation.effects === "object");
}
