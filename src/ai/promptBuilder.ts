import type { IntentInterpretationInput } from "../core/intent/types";

export function buildAIInterpreterPrompts(input: IntentInterpretationInput): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: [
      "You interpret stroke-based level-authoring intent.",
      "Return only structured intent effects, never rooms, coordinates for rooms, corridors, or final levels.",
      "Preserve locality: each interpretation must remain bound to its source stroke ids.",
    ].join("\n"),
    userPrompt: JSON.stringify({
      strokes: input.strokes.map((stroke) => ({ id: stroke.id, type: stroke.type, width: stroke.width, intensity: stroke.intensity, pointCount: stroke.points.length })),
      textInstruction: input.textInstruction ?? "",
      currentLevelContext: input.currentLevelContext ? { activeVariantId: input.currentLevelContext.activeVariantId, workingVariantId: input.currentLevelContext.workingVariantId } : undefined,
    }, null, 2),
  };
}
