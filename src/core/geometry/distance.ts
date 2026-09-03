import type { Point, Stroke } from "../types";

export const distance = (a: Pick<Point, "x" | "y">, b: Pick<Point, "x" | "y">): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(points: Point[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

export function bounds(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function centroid(points: Point[]): Point {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length, time: Date.now() };
}

export function minDistanceToStroke(point: Pick<Point, "x" | "y">, stroke: Stroke): number {
  return Math.min(...stroke.points.map((candidate) => distance(point, candidate)));
}

export function resamplePath(points: Point[], count: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1 || count <= 1) return [points[0]];
  const totalLength = pathLength(points);
  const step = totalLength / (count - 1);
  const result: Point[] = [points[0]];
  let carried = 0;
  let segmentStart = points[0];
  for (let i = 1; i < points.length && result.length < count - 1; i += 1) {
    const segmentEnd = points[i];
    let segmentLength = distance(segmentStart, segmentEnd);
    while (carried + segmentLength >= step && result.length < count - 1) {
      const t = (step - carried) / segmentLength;
      const next = {
        x: segmentStart.x + (segmentEnd.x - segmentStart.x) * t,
        y: segmentStart.y + (segmentEnd.y - segmentStart.y) * t,
        time: segmentEnd.time,
      };
      result.push(next);
      segmentStart = next;
      segmentLength = distance(segmentStart, segmentEnd);
      carried = 0;
    }
    carried += segmentLength;
    segmentStart = segmentEnd;
  }
  result.push(points[points.length - 1]);
  return result;
}
