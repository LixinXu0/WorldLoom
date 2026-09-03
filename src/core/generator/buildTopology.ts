import type { GameplayConstraint, Point, Stroke } from "../types";
import { resamplePath } from "../geometry/distance";

export type TopologyNode = { id: string; point: Point; sourceStrokeIds: string[]; sourceConstraintIds: string[] };

export function buildMainPath(strokes: Stroke[], constraints: GameplayConstraint[], width: number, height: number): TopologyNode[] {
  const flowStrokes = strokes.filter((stroke) => stroke.enabled && stroke.type === "flow");
  const flowConstraintIds = constraints.filter((constraint) => constraint.target === "main_path").map((constraint) => constraint.id);
  if (flowStrokes.length === 0) {
    return [
      { id: "T0", point: { x: 64, y: height / 2, time: 0 }, sourceStrokeIds: [], sourceConstraintIds: flowConstraintIds },
      { id: "T1", point: { x: width * 0.26, y: height / 2 - 24, time: 0 }, sourceStrokeIds: [], sourceConstraintIds: flowConstraintIds },
      { id: "T2", point: { x: width * 0.48, y: height / 2 + 28, time: 0 }, sourceStrokeIds: [], sourceConstraintIds: flowConstraintIds },
      { id: "T3", point: { x: width * 0.72, y: height / 2 - 18, time: 0 }, sourceStrokeIds: [], sourceConstraintIds: flowConstraintIds },
      { id: "T4", point: { x: width - 64, y: height / 2, time: 0 }, sourceStrokeIds: [], sourceConstraintIds: flowConstraintIds },
    ];
  }
  const longest = [...flowStrokes].sort((a, b) => b.points.length - a.points.length)[0];
  const count = Math.max(5, Math.min(10, Math.round(longest.points.length / 8)));
  return resamplePath(longest.points, count).map((point, index) => ({ id: `T${index}`, point, sourceStrokeIds: [longest.id], sourceConstraintIds: flowConstraintIds }));
}
