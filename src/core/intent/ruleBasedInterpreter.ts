import type { Stroke } from "../types";
import { detectConflicts } from "../compiler/detectConflicts";
import { extractStrokeFeatures } from "../compiler/extractStrokeFeatures";
import { intentToConstraints } from "./intentToConstraints";
import type { AuthoringIR, IntentInterpretation, IntentInterpretationInput, IntentInterpretationResult, IntentInterpreter } from "./types";

export const ruleBasedInterpreterVersion = "rule-based-1.0.0";

export function createRuleBasedAuthoringIR(strokes: Stroke[]): { authoringIntent: AuthoringIR; interpretations: IntentInterpretation[] } {
  const intents: AuthoringIR["intents"] = [];
  const interpretations: IntentInterpretation[] = [];

  for (const feature of extractStrokeFeatures(strokes).filter((feature) => feature.stroke.enabled)) {
    const stroke = feature.stroke;
    const interpretationId = `I-${stroke.id}`;

    if (stroke.type === "flow") {
      intents.push({ id: `${interpretationId}-flow`, kind: "flow", sourceStrokeIds: [stroke.id], trajectory: stroke.points, width: stroke.width, priority: Math.min(1, feature.length / 760) });
      interpretations.push({ id: interpretationId, sourceStrokeIds: [stroke.id], semanticSummary: "Predefined main path trajectory", confidence: 1, effects: {}, alternatives: [] });
    }

    if (stroke.type === "pressure") {
      const effects = { encounterIntensity: stroke.intensity, spatialOpenness: -stroke.intensity, resourceDensity: -stroke.intensity, visibility: -stroke.intensity };
      intents.push({ id: `${interpretationId}-pressure`, kind: "experience", sourceStrokeIds: [stroke.id], semanticLabel: "pressure", spatialScope: { x: feature.center.x, y: feature.center.y, radius: feature.radius }, intensity: stroke.intensity, effects });
      interpretations.push({
        id: interpretationId,
        sourceStrokeIds: [stroke.id],
        semanticSummary: "Predefined tension mapping: more combat, tighter space, fewer resources, lower visibility",
        confidence: 1,
        effects,
        alternatives: [
          { id: `${interpretationId}-spatial`, label: "Spatial pressure", semanticSummary: "Tight space without extra combat", effects: { spatialOpenness: -stroke.intensity, visibility: -0.5 * stroke.intensity, encounterIntensity: 0 } },
          { id: `${interpretationId}-exposed`, label: "Exposed pressure", semanticSummary: "Open exposure with moderate threat", effects: { spatialOpenness: 0.6 * stroke.intensity, visibility: 0.7 * stroke.intensity, encounterIntensity: 0.35 * stroke.intensity } },
        ],
      });
    }

    if (stroke.type === "relief") {
      const effects = { recovery: stroke.intensity, resourceDensity: stroke.intensity, spatialOpenness: stroke.intensity, encounterIntensity: -stroke.intensity };
      intents.push({ id: `${interpretationId}-relief`, kind: "experience", sourceStrokeIds: [stroke.id], semanticLabel: "relief", spatialScope: { x: feature.center.x, y: feature.center.y, radius: feature.radius }, intensity: stroke.intensity, effects });
      interpretations.push({
        id: interpretationId,
        sourceStrokeIds: [stroke.id],
        semanticSummary: "Predefined recovery mapping: more resources, more openness, lower combat",
        confidence: 1,
        effects,
        alternatives: [
          { id: `${interpretationId}-breathing`, label: "Breathing room", semanticSummary: "Spatial relief without extra resources", effects: { spatialOpenness: stroke.intensity, recovery: 0.5 * stroke.intensity, resourceDensity: 0, encounterIntensity: -stroke.intensity } },
        ],
      });
    }

    if (stroke.type === "branch") {
      const effects = { branching: stroke.intensity };
      intents.push({ id: `${interpretationId}-branch`, kind: "branch", sourceStrokeIds: [stroke.id], trajectory: stroke.points, optionality: stroke.intensity, reconnectPreference: 0.7 });
      interpretations.push({
        id: interpretationId,
        sourceStrokeIds: [stroke.id],
        semanticSummary: "Predefined optional branch request",
        confidence: 1,
        effects,
        alternatives: [
          { id: `${interpretationId}-shortcut`, label: "Risky shortcut", semanticSummary: "Optional shortcut with higher danger and later reconnect", effects: { branching: stroke.intensity, encounterIntensity: 0.55 * stroke.intensity } },
        ],
      });
    }
  }

  const authoringIntent = { id: "AIR-rule-based", intents };
  return { authoringIntent, interpretations };
}

export function interpretRuleBasedSync(input: IntentInterpretationInput): IntentInterpretationResult {
  const { authoringIntent, interpretations } = createRuleBasedAuthoringIR(input.strokes);
  const derivedConstraints = intentToConstraints(authoringIntent, input.strokes, interpretations);
  return {
    mode: "rule-based",
    interpretations,
    authoringIntent,
    derivedConstraints,
    conflicts: detectConflicts(input.strokes, derivedConstraints),
    metadata: {
      interpreterMode: "rule-based",
      interpreterVersion: ruleBasedInterpreterVersion,
      createdAt: Date.now(),
      sourceStrokeIds: input.strokes.map((stroke) => stroke.id),
      textInstruction: input.textInstruction,
      confidence: 1,
      rationale: "Deterministic baseline stroke-to-constraint mapping.",
      manuallyAdjusted: false,
    },
  };
}

export class RuleBasedIntentInterpreter implements IntentInterpreter {
  id = "rule-based";
  name = "Rule-Based Interpretation";

  async interpret(input: IntentInterpretationInput): Promise<IntentInterpretationResult> {
    return interpretRuleBasedSync(input);
  }
}
