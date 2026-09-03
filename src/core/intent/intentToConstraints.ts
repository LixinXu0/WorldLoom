import type { AuthoringIntent, AuthoringIR, IntentEffectName, IntentInterpretation } from "./types";
import type { ConstraintTarget, GameplayConstraint, Stroke } from "../types";

const effectToTarget: Record<IntentEffectName, ConstraintTarget> = {
  encounterIntensity: "encounter_intensity",
  spatialOpenness: "spatial_openness",
  visibility: "visibility",
  resourceDensity: "resource_density",
  recovery: "recovery",
  branching: "branching",
};

function regionFor(intent: AuthoringIntent): { x: number; y: number; radius: number } {
  if (intent.kind === "flow" || intent.kind === "branch") {
    const points = intent.trajectory;
    const center = points.length === 0
      ? { x: 480, y: 280 }
      : { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
    const radius = Math.max(70, ...points.map((point) => Math.hypot(point.x - center.x, point.y - center.y)));
    return { x: center.x, y: center.y, radius };
  }
  if (Array.isArray(intent.spatialScope)) {
    const points = intent.spatialScope;
    const center = points.length === 0
      ? { x: 480, y: 280 }
      : { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
    const radius = Math.max(70, ...points.map((point) => Math.hypot(point.x - center.x, point.y - center.y)));
    return { x: center.x, y: center.y, radius };
  }
  return intent.spatialScope;
}

function preferredValue(effectValue: number): number {
  return effectValue >= 0 ? Math.min(1, effectValue) : Math.max(0, 1 + effectValue);
}

function explanationFor(intent: AuthoringIntent, target: ConstraintTarget, interpretation?: IntentInterpretation): string {
  if (interpretation) return `${interpretation.semanticSummary} (${target}).`;
  if (intent.kind === "flow") return `Flow ${intent.sourceStrokeIds.join(", ")} defines the preferred main path direction and room sequence.`;
  if (intent.kind === "branch") return `Branch ${intent.sourceStrokeIds.join(", ")} requests optional route structure near the main path.`;
  return `${intent.semanticLabel === "pressure" ? "Pressure" : "Relief"} ${intent.sourceStrokeIds.join(", ")} shapes ${target}.`;
}

export function intentToConstraints(ir: AuthoringIR, strokes: Stroke[], interpretations: IntentInterpretation[] = []): GameplayConstraint[] {
  const constraints: GameplayConstraint[] = [];
  let serial = 1;
  const nextId = (): string => `C${String(serial++).padStart(3, "0")}`;
  const byStroke = new Map(interpretations.flatMap((interpretation) => interpretation.sourceStrokeIds.map((id) => [id, interpretation] as const)));

  for (const intent of ir.intents) {
    const interpretation = intent.sourceStrokeIds.map((id) => byStroke.get(id)).find(Boolean);
    if (intent.kind === "flow") {
      constraints.push({
        id: nextId(),
        sourceStrokeIds: intent.sourceStrokeIds,
        sourceInterpretationIds: interpretation ? [interpretation.id] : [],
        target: "main_path",
        region: regionFor(intent),
        preferredValue: Math.min(1, intent.priority),
        weight: intent.priority,
        hard: true,
        enabled: true,
        explanation: explanationFor(intent, "main_path", interpretation),
      });
    }

    if (intent.kind === "branch") {
      constraints.push({
        id: nextId(),
        sourceStrokeIds: intent.sourceStrokeIds,
        sourceInterpretationIds: interpretation ? [interpretation.id] : [],
        target: "branching",
        region: regionFor(intent),
        preferredValue: Math.min(1, Math.max(0, intent.optionality)),
        weight: Math.min(1, Math.max(0.1, intent.optionality)),
        hard: false,
        enabled: true,
        explanation: explanationFor(intent, "branching", interpretation),
      });
    }

    if (intent.kind === "experience") {
      for (const [effect, value] of Object.entries(intent.effects)) {
        const target = effectToTarget[effect as IntentEffectName];
        if (!target) continue;
        constraints.push({
          id: nextId(),
          sourceStrokeIds: intent.sourceStrokeIds,
          sourceInterpretationIds: interpretation ? [interpretation.id] : [],
          target,
          region: regionFor(intent),
          preferredValue: preferredValue(value),
          weight: intent.intensity,
          hard: false,
          enabled: true,
          explanation: explanationFor(intent, target, interpretation),
        });
      }
    }
  }

  if (!strokes.some((stroke) => stroke.enabled && stroke.type === "flow")) {
    constraints.push({
      id: nextId(),
      sourceStrokeIds: [],
      sourceInterpretationIds: [],
      target: "main_path",
      region: { x: 480, y: 280, radius: 460 },
      preferredValue: 0.5,
      weight: 0.45,
      hard: true,
      enabled: true,
      explanation: "No Flow stroke exists, so Worldloom uses a default entrance-to-exit path.",
    });
  }

  return constraints;
}
