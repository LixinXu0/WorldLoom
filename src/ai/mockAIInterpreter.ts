import type { ConstraintConflict, Stroke } from "../core/types";
import { extractStrokeFeatures } from "../core/compiler/extractStrokeFeatures";
import { intentToConstraints } from "../core/intent/intentToConstraints";
import type { AuthoringIR, IntentEffects, IntentInterpretation, IntentInterpretationInput, IntentInterpretationResult, IntentInterpreter } from "../core/intent/types";
import { buildSketchPatternSignature } from "../core/sketch/patternSignature";

const version = "mock-ai-1.0.0";

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

function pressureEffects(stroke: Stroke, text: string): { summary: string; confidence: number; effects: IntentEffects; conflict?: string } {
  if (has(text, /claustrophobic|cramped|tight|narrow|not combat|without.*combat|do not increase combat/)) {
    return { summary: "Claustrophobic spatial pressure with minimal combat escalation", confidence: 0.86, effects: { spatialOpenness: -0.9 * stroke.intensity, visibility: -0.55 * stroke.intensity, encounterIntensity: 0, resourceDensity: -0.15 * stroke.intensity } };
  }
  if (has(text, /exposed|exposure|open.*threat|visible/)) {
    return { summary: "Exposure-based pressure in open space with moderate threat", confidence: 0.82, effects: { spatialOpenness: 0.7 * stroke.intensity, visibility: 0.75 * stroke.intensity, encounterIntensity: 0.35 * stroke.intensity, resourceDensity: -0.1 * stroke.intensity } };
  }
  return { summary: "Default pressure interpretation with combat and spatial tension", confidence: 0.68, effects: { encounterIntensity: stroke.intensity, spatialOpenness: -stroke.intensity, resourceDensity: -stroke.intensity, visibility: -stroke.intensity } };
}

function reliefEffects(stroke: Stroke, text: string): { summary: string; confidence: number; effects: IntentEffects; conflict?: string } {
  if (has(text, /most stressful|stressful|dangerous|high pressure/)) {
    return { summary: "Conflicting relief stroke and stressful language", confidence: 0.38, effects: { recovery: 0.2 * stroke.intensity, spatialOpenness: 0.2 * stroke.intensity, encounterIntensity: 0.55 * stroke.intensity }, conflict: "Stroke suggests relief, while language suggests high pressure." };
  }
  if (has(text, /breathing room|no extra resources|without resources/)) {
    return { summary: "Breathing room without additional resource density", confidence: 0.84, effects: { spatialOpenness: 0.9 * stroke.intensity, recovery: 0.5 * stroke.intensity, resourceDensity: 0, encounterIntensity: -0.7 * stroke.intensity } };
  }
  return { summary: "Default relief interpretation with recovery, resources, and openness", confidence: 0.7, effects: { recovery: stroke.intensity, resourceDensity: stroke.intensity, spatialOpenness: stroke.intensity, encounterIntensity: -stroke.intensity } };
}

function branchEffects(stroke: Stroke, text: string): { summary: string; confidence: number; effects: IntentEffects; shortcutBias?: number; risk?: number; reconnectPreference?: number } {
  if (has(text, /risky shortcut|shortcut|optional risky/)) {
    return { summary: "Optional risky shortcut that reconnects later", confidence: 0.85, effects: { branching: stroke.intensity, encounterIntensity: 0.55 * stroke.intensity, spatialOpenness: -0.25 * stroke.intensity }, shortcutBias: 0.85, risk: 0.75, reconnectPreference: 0.9 };
  }
  return { summary: "Optional branch with later reconnection", confidence: 0.72, effects: { branching: stroke.intensity }, reconnectPreference: 0.7 };
}

export function interpretMockAISync(input: IntentInterpretationInput): IntentInterpretationResult {
  const text = input.textInstruction ?? "";
  const interpretations: IntentInterpretation[] = [];
  const intents: AuthoringIR["intents"] = [];
  const conflicts: ConstraintConflict[] = [];

  for (const feature of extractStrokeFeatures(input.strokes).filter((feature) => feature.stroke.enabled)) {
    const stroke = feature.stroke;
    const id = `AI-${stroke.id}`;

    if (stroke.type === "flow") {
      interpretations.push({ id, sourceStrokeIds: [stroke.id], semanticSummary: "Main route trajectory preserved from Flow stroke", confidence: 0.95, effects: {}, alternatives: [] });
      intents.push({ id: `${id}-flow`, kind: "flow", sourceStrokeIds: [stroke.id], trajectory: stroke.points, width: stroke.width, priority: Math.min(1, feature.length / 760) });
    }

    if (stroke.type === "pressure") {
      const interpreted = pressureEffects(stroke, text);
      interpretations.push({
        id,
        sourceStrokeIds: [stroke.id],
        semanticSummary: interpreted.summary,
        confidence: interpreted.confidence,
        effects: interpreted.effects,
        alternatives: [
          { id: `${id}-combat`, label: "Combat pressure", semanticSummary: "Combat-heavy pressure", effects: { encounterIntensity: stroke.intensity, spatialOpenness: -0.25 * stroke.intensity } },
          { id: `${id}-spatial`, label: "Claustrophobic pressure", semanticSummary: "Spatial compression without combat escalation", effects: { spatialOpenness: -0.9 * stroke.intensity, visibility: -0.5 * stroke.intensity, encounterIntensity: 0 } },
          { id: `${id}-exposed`, label: "Exposed pressure", semanticSummary: "Open exposure with moderate threat", effects: { spatialOpenness: 0.7 * stroke.intensity, visibility: 0.75 * stroke.intensity, encounterIntensity: 0.35 * stroke.intensity } },
        ],
      });
      intents.push({ id: `${id}-pressure`, kind: "experience", sourceStrokeIds: [stroke.id], semanticLabel: "pressure", spatialScope: { x: feature.center.x, y: feature.center.y, radius: feature.radius }, intensity: stroke.intensity, effects: interpreted.effects });
    }

    if (stroke.type === "relief") {
      const interpreted = reliefEffects(stroke, text);
      interpretations.push({
        id,
        sourceStrokeIds: [stroke.id],
        semanticSummary: interpreted.summary,
        confidence: interpreted.confidence,
        effects: interpreted.effects,
        conflict: interpreted.conflict,
        alternatives: [
          { id: `${id}-stroke`, label: "Prefer stroke", semanticSummary: "Treat this as recovery relief", effects: { recovery: stroke.intensity, spatialOpenness: stroke.intensity, encounterIntensity: -stroke.intensity } },
          { id: `${id}-language`, label: "Prefer language", semanticSummary: "Treat language as high pressure", effects: { encounterIntensity: 0.75 * stroke.intensity, recovery: 0 } },
          { id: `${id}-blend`, label: "Blend", semanticSummary: "Create tense recovery with partial safety", effects: { recovery: 0.35 * stroke.intensity, encounterIntensity: 0.25 * stroke.intensity } },
        ],
      });
      if (interpreted.conflict) {
        conflicts.push({ id: `IC-${stroke.id}`, type: "opposed_intensity", constraintIds: [], strokeIds: [stroke.id], severity: "warning", message: interpreted.conflict, suggestedResolutions: ["Prefer stroke", "Prefer language", "Blend", "Clarify"] });
      }
      intents.push({ id: `${id}-relief`, kind: "experience", sourceStrokeIds: [stroke.id], semanticLabel: "relief", spatialScope: { x: feature.center.x, y: feature.center.y, radius: feature.radius }, intensity: stroke.intensity, effects: interpreted.effects });
    }

    if (stroke.type === "branch") {
      const interpreted = branchEffects(stroke, text);
      interpretations.push({
        id,
        sourceStrokeIds: [stroke.id],
        semanticSummary: interpreted.summary,
        confidence: interpreted.confidence,
        effects: interpreted.effects,
        alternatives: [
          { id: `${id}-branch`, label: "Optional branch", semanticSummary: "Optional branch content", effects: { branching: stroke.intensity } },
          { id: `${id}-shortcut`, label: "Risky shortcut", semanticSummary: "Shorter risky route that reconnects later", effects: { branching: stroke.intensity, encounterIntensity: 0.55 * stroke.intensity } },
        ],
      });
      intents.push({ id: `${id}-branch`, kind: "branch", sourceStrokeIds: [stroke.id], trajectory: stroke.points, optionality: stroke.intensity, reconnectPreference: interpreted.reconnectPreference, shortcutBias: interpreted.shortcutBias, risk: interpreted.risk });
    }
  }

  if (input.sketchState && input.sketchState.marks.some((mark) => !mark.kind.startsWith("legacy-")) || input.sketchState?.objects.length || input.sketchState?.relations.length) {
    const sketch = input.sketchState;
    const signature = buildSketchPatternSignature(sketch);
    const ids = [...sketch.marks.map((mark) => mark.id), ...sketch.objects.map((object) => object.id), ...sketch.relations.map((relation) => relation.id)];
    const hasEnemy = sketch.objects.some((object) => object.objectType === "enemy");
    const hasResource = sketch.objects.some((object) => object.objectType === "resource");
    const hasKeyDoor = sketch.objects.some((object) => object.objectType === "key") && sketch.objects.some((object) => object.objectType === "door") && sketch.relations.some((relation) => relation.relationType === "connects" || relation.relationType === "leads_to");
    const wantsRecovery = has(text, /recovery|relief|safe|breathing|rest/);
    const summary = hasKeyDoor
      ? "Key object appears to gate or unlock the door"
      : signature.hasClosedRegion && hasEnemy && signature.hasArrow
        ? "Encounter pocket connected to the main route"
        : signature.hasClosedRegion && (hasResource || wantsRecovery)
          ? "Recovery pocket grounded in a marked region"
          : signature.hasArrow
            ? "Possible player flow or object relationship"
            : "Ambiguous abstract sketch expression";
    const effects: IntentEffects = hasKeyDoor
      ? { branching: 0.35 }
      : summary.includes("Recovery") ? { recovery: 0.85, spatialOpenness: 0.65, encounterIntensity: -0.65, resourceDensity: hasResource ? 0.45 : 0 }
      : summary.includes("Encounter") ? { encounterIntensity: 0.75, branching: 0.35, spatialOpenness: -0.25 }
      : { branching: 0.45 };
    interpretations.push({
      id: "AI-sketch-1",
      sourceStrokeIds: ids,
      semanticSummary: summary,
      confidence: summary.includes("Ambiguous") || summary.includes("Possible") ? 0.48 : 0.76,
      effects,
      alternatives: [
        { id: "AI-sketch-combat", label: "Combat area", semanticSummary: "Treat the sketch group as a combat pocket", effects: { encounterIntensity: 0.8, spatialOpenness: -0.25 } },
        { id: "AI-sketch-relief", label: "Recovery pocket", semanticSummary: "Treat the sketch group as a recovery pocket", effects: { recovery: 0.85, spatialOpenness: 0.65, encounterIntensity: -0.65, resourceDensity: 0.2 } },
        { id: "AI-sketch-route", label: "Route relation", semanticSummary: "Treat the arrow/relation as route structure", effects: { branching: 0.65 } },
      ],
    });
    intents.push({
      id: "AI-sketch-intent-1",
      kind: "experience",
      sourceStrokeIds: ids,
      semanticLabel: summary.includes("Recovery") ? "relief" : "pressure",
      spatialScope: { x: 480, y: 280, radius: 220 },
      intensity: 0.76,
      effects,
    });
  }

  const authoringIntent: AuthoringIR = { id: "AIR-mock-ai", intents };
  const derivedConstraints = intentToConstraints(authoringIntent, input.strokes, interpretations);
  return {
    mode: "ai",
    interpretations,
    authoringIntent,
    derivedConstraints,
    conflicts,
    metadata: {
      interpreterMode: "ai",
      interpreterVersion: version,
      createdAt: Date.now(),
      sourceStrokeIds: input.strokes.map((stroke) => stroke.id),
      textInstruction: input.textInstruction,
      confidence: interpretations.length === 0 ? 0 : interpretations.reduce((sum, item) => sum + item.confidence, 0) / interpretations.length,
      rationale: "Mock structured AI interpreter for local research workflows.",
      manuallyAdjusted: false,
    },
  };
}

export class MockAIInterpreter implements IntentInterpreter {
  id = "mock-ai";
  name = "AI-Assisted Interpretation (Mock)";

  async interpret(input: IntentInterpretationInput): Promise<IntentInterpretationResult> {
    return interpretMockAISync(input);
  }
}
