import { nanoid } from "nanoid";
import type { AssetInstance, Bounds, GeometricGestureCandidate, RawStroke, RawStrokePoint } from "./types";

export function boundsForRawStroke(stroke: RawStroke): Bounds {
  if (stroke.points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) };
}

export function lengthOfRawStroke(points: RawStrokePoint[]): number {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

export function classifyRawStrokeGesture(stroke: RawStroke): GeometricGestureCandidate {
  const bounds = boundsForRawStroke(stroke);
  const length = lengthOfRawStroke(stroke.points);
  const first = stroke.points[0];
  const last = stroke.points.at(-1);
  const endpointDistance = first && last ? Math.hypot(first.x - last.x, first.y - last.y) : 0;
  const diagonal = Math.hypot(bounds.width, bounds.height);
  const closure = diagonal === 0 ? 0 : Math.max(0, 1 - endpointDistance / Math.max(1, diagonal));
  const directionality = diagonal === 0 || length === 0 ? 0 : Math.min(1, endpointDistance / Math.max(1, length));
  let kind: GeometricGestureCandidate["kind"] = "unknown";
  let confidence = 0.35;

  if (stroke.points.length < 3) {
    kind = "unknown";
  } else if (closure > 0.72 && length > diagonal * 1.8) {
    kind = "closed_loop";
    confidence = Math.min(0.94, closure);
  } else if (directionality > 0.72 && length > 45) {
    kind = "arrow_like";
    confidence = Math.min(0.82, directionality);
  } else if (directionality > 0.55 && length > 35) {
    kind = "open_path";
    confidence = 0.62;
  } else if (length < 80 && diagonal < 52) {
    kind = "symbol_like";
    confidence = 0.58;
  }

  return {
    id: `GEO-${nanoid(6)}`,
    strokeIds: [stroke.id],
    kind,
    confidence,
    features: { closure: Number(closure.toFixed(3)), directionality: Number(directionality.toFixed(3)), boundingBox: bounds, length: Number(length.toFixed(1)), intersections: 0 },
  };
}

export function nearbyAssetsForStroke(stroke: RawStroke, assets: AssetInstance[], padding = 42): string[] {
  const bounds = boundsForRawStroke(stroke);
  return assets.filter((asset) => asset.position.x >= bounds.x - padding && asset.position.x <= bounds.x + bounds.width + padding && asset.position.y >= bounds.y - padding && asset.position.y <= bounds.y + bounds.height + padding).map((asset) => asset.id);
}
