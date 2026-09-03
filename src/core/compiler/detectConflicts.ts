import type { ConstraintConflict, GameplayConstraint, Stroke } from "../types";
import { distance, minDistanceToStroke } from "../geometry/distance";

export function detectConflicts(strokes: Stroke[], constraints: GameplayConstraint[]): ConstraintConflict[] {
  const conflicts: ConstraintConflict[] = [];
  let serial = 1;
  const nextId = (): string => `K${String(serial++).padStart(3, "0")}`;
  const pressure = strokes.filter((stroke) => stroke.enabled && stroke.type === "pressure");
  const relief = strokes.filter((stroke) => stroke.enabled && stroke.type === "relief");
  const flow = strokes.filter((stroke) => stroke.enabled && stroke.type === "flow");
  const branch = strokes.filter((stroke) => stroke.enabled && stroke.type === "branch");
  for (const p of pressure) for (const r of relief) {
    const close = p.points.some((point) => minDistanceToStroke(point, r) < Math.max(p.width, r.width) * 4);
    if (close && p.intensity > 0.65 && r.intensity > 0.65) conflicts.push({ id: nextId(), type: "pressure_relief_overlap", constraintIds: constraints.filter((item) => item.sourceStrokeIds.includes(p.id) || item.sourceStrokeIds.includes(r.id)).map((item) => item.id), strokeIds: [p.id, r.id], severity: "warning", message: "High Pressure and high Relief overlap in the same region.", suggestedResolutions: ["sequence", "nested", "blend", "prioritize-pressure", "prioritize-relief"] });
  }
  for (const b of branch) {
    const minFlowDistance = flow.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...b.points.map((point) => Math.min(...flow.map((item) => minDistanceToStroke(point, item)))));
    if (minFlowDistance > 130) conflicts.push({ id: nextId(), type: "branch_far_from_flow", constraintIds: constraints.filter((item) => item.sourceStrokeIds.includes(b.id)).map((item) => item.id), strokeIds: [b.id], severity: "warning", message: "Branch intent sits far from all Flow strokes, so it may become a dead end.", suggestedResolutions: ["nested", "blend"] });
  }
  if (flow.length > 1) for (let i = 1; i < flow.length; i += 1) {
    const gap = Math.min(...flow[i].points.map((point) => minDistanceToStroke(point, flow[i - 1])));
    if (gap > 180) conflicts.push({ id: nextId(), type: "disconnected_flow", constraintIds: constraints.filter((item) => flow.some((stroke) => item.sourceStrokeIds.includes(stroke.id))).map((item) => item.id), strokeIds: [flow[i - 1].id, flow[i].id], severity: "error", message: "Multiple Flow strokes are disconnected enough to imply competing main paths.", suggestedResolutions: ["sequence", "blend"] });
  }
  const entrance = { x: 64, y: 280 };
  const exit = { x: 896, y: 280 };
  if (relief.length > 0 && relief.every((stroke) => stroke.points.some((point) => distance(point, entrance) < 150))) conflicts.push({ id: nextId(), type: "entry_relief_only", constraintIds: constraints.filter((item) => item.target === "recovery").map((item) => item.id), strokeIds: relief.map((stroke) => stroke.id), severity: "info", message: "Relief appears only near the entrance, leaving later recovery pacing undefined.", suggestedResolutions: ["sequence", "blend"] });
  for (const p of pressure) if (p.intensity > 0.7 && p.points.some((point) => distance(point, entrance) < 95 || distance(point, exit) < 95)) conflicts.push({ id: nextId(), type: "anchor_pressure", constraintIds: constraints.filter((item) => item.sourceStrokeIds.includes(p.id)).map((item) => item.id), strokeIds: [p.id], severity: "warning", message: "High Pressure covers the entrance or exit anchor.", suggestedResolutions: ["prioritize-pressure", "sequence"] });
  const intensityHigh = constraints.filter((item) => item.target === "encounter_intensity" && item.preferredValue > 0.65);
  const intensityLow = constraints.filter((item) => item.target === "encounter_intensity" && item.preferredValue < 0.35);
  for (const high of intensityHigh) for (const low of intensityLow) if (distance(high.region, low.region) < Math.max(high.region.radius, low.region.radius) * 0.75) conflicts.push({ id: nextId(), type: "opposed_intensity", constraintIds: [high.id, low.id], strokeIds: [...high.sourceStrokeIds, ...low.sourceStrokeIds], severity: "warning", message: "Encounter intensity is simultaneously pushed high and low in one region.", suggestedResolutions: ["sequence", "nested", "prioritize-pressure", "prioritize-relief"] });
  return conflicts;
}
