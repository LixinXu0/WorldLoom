import type { IntentInterpretationInput, IntentInterpretationResult, IntentInterpreter } from "../core/intent/types";
import { intentToConstraints } from "../core/intent/intentToConstraints";
import { detectConflicts } from "../core/compiler/detectConflicts";
import { aiIntentSchema, validateAIIntentOutput } from "./AIIntentSchema";
import { buildAIInterpreterPrompts } from "./promptBuilder";
import type { StructuredLLMProvider } from "./provider";
import { interpretMockAISync } from "./mockAIInterpreter";

export class AIIntentInterpreter implements IntentInterpreter {
  id = "ai";
  name = "AI-Assisted Interpretation";

  constructor(private provider?: StructuredLLMProvider) {}

  async interpret(input: IntentInterpretationInput): Promise<IntentInterpretationResult> {
    if (!this.provider) return interpretMockAISync(input);
    const prompts = buildAIInterpreterPrompts(input);
    const output = await this.provider.completeStructured<unknown>(prompts.systemPrompt, prompts.userPrompt, aiIntentSchema);
    if (!validateAIIntentOutput(output)) return interpretMockAISync(input);

    const mock = interpretMockAISync(input);
    const interpretations = output.interpretations.map((item, index) => ({
      id: `AI-provider-${index + 1}`,
      sourceStrokeIds: item.sourceStrokeIds,
      semanticSummary: item.semanticSummary,
      confidence: item.confidence,
      effects: item.effects,
      conflict: item.conflict,
      alternatives: (item.alternatives ?? []).map((alternative, alternativeIndex) => ({ id: `AI-provider-${index + 1}-alt-${alternativeIndex + 1}`, ...alternative })),
    }));
    const authoringIntent = {
      ...mock.authoringIntent,
      id: "AIR-provider-ai",
      intents: mock.authoringIntent.intents.map((intent) => {
        const interpretation = interpretations.find((item) => intent.sourceStrokeIds.some((id) => item.sourceStrokeIds.includes(id)));
        return interpretation && intent.kind === "experience" ? { ...intent, effects: interpretation.effects } : intent;
      }),
    };
    const derivedConstraints = intentToConstraints(authoringIntent, input.strokes, interpretations);
    return {
      mode: "ai",
      interpretations,
      authoringIntent,
      derivedConstraints,
      conflicts: detectConflicts(input.strokes, derivedConstraints),
      metadata: { ...mock.metadata, interpreterVersion: "provider-ai-1.0.0", confidence: interpretations.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, interpretations.length) },
    };
  }
}
