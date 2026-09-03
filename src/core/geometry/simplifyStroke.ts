import type { Point } from "../types";

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

export function simplifyStroke(points: Point[], epsilon = 2.5): Point[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const candidate = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (candidate > maxDistance) {
      maxDistance = candidate;
      index = i;
    }
  }
  if (maxDistance > epsilon) {
    const left = simplifyStroke(points.slice(0, index + 1), epsilon);
    const right = simplifyStroke(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}
