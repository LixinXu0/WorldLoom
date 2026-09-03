import type { GameplayConstraint, Stroke, TimelinePoint } from "../types";

export function calculateIntendedTimeline(strokes: Stroke[], constraints: GameplayConstraint[]): TimelinePoint[] {
  const flow = strokes.find((stroke) => stroke.enabled && stroke.type === "flow");
  const sourcePoints = flow?.points ?? [{ x: 80, y: 280, time: 1 }, { x: 880, y: 280, time: 2 }];
  return sourcePoints.map((point, index) => {
    const nearby = constraints.filter((constraint) => Math.hypot(constraint.region.x - point.x, constraint.region.y - point.y) < constraint.region.radius + 130);
    const pressure = nearby.filter((constraint) => constraint.target === "encounter_intensity").reduce((max, constraint) => Math.max(max, constraint.preferredValue * constraint.weight), 0);
    const relief = nearby.filter((constraint) => constraint.target === "recovery" || constraint.target === "resource_density").reduce((max, constraint) => Math.max(max, constraint.preferredValue * constraint.weight), 0);
    return { id: `intended-${index}`, label: index === 0 ? "ENT" : index === sourcePoints.length - 1 ? "EXIT" : `I${index}`, pressure: Math.min(1, pressure), relief: Math.min(1, relief) };
  });
}