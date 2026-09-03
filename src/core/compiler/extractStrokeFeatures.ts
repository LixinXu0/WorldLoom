import type { Stroke } from "../types";
import { bounds, centroid, pathLength } from "../geometry/distance";

export type StrokeFeature = {
  stroke: Stroke;
  length: number;
  center: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  radius: number;
};

export function extractStrokeFeatures(strokes: Stroke[]): StrokeFeature[] {
  return strokes
    .filter((stroke) => stroke.enabled && stroke.points.length > 0)
    .map((stroke) => {
      const strokeBounds = bounds(stroke.points);
      return {
        stroke,
        length: pathLength(stroke.points),
        center: centroid(stroke.points),
        bounds: strokeBounds,
        radius: Math.max(stroke.width * 3, Math.max(strokeBounds.width, strokeBounds.height) / 2, 28),
      };
    });
}
