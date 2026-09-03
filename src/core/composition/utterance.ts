import { nanoid } from "nanoid";
import type { Point } from "../types";
import type { AssetAwareVisualUtterance, Bounds, SketchState } from "../sketch/types";

function boundsFromPoints(points: Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) };
}

export function createUtteranceFromSelection(sketch: SketchState, selectedIds: string[], now = Date.now()): AssetAwareVisualUtterance {
  const selected = new Set(selectedIds.length > 0 ? selectedIds : [
    ...sketch.assetInstances.map((asset) => asset.id),
    ...sketch.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => stroke.id),
    ...sketch.marks.map((mark) => mark.id),
    ...sketch.relations.map((relation) => relation.id),
    ...sketch.annotations.map((annotation) => annotation.id),
  ]);
  const markIds = sketch.marks.filter((mark) => selected.has(mark.id)).map((mark) => mark.id);
  const rawStrokeIds = sketch.rawStrokes.filter((stroke) => !stroke.deleted && selected.has(stroke.id)).map((stroke) => stroke.id);
  const gestureCandidateIds = sketch.gestureCandidates.filter((gesture) => gesture.strokeIds.some((id) => selected.has(id))).map((gesture) => gesture.id);
  const assetInstanceIds = sketch.assetInstances.filter((asset) => selected.has(asset.id)).map((asset) => asset.id);
  const relationIds = sketch.relations.filter((relation) => selected.has(relation.id) || selected.has(relation.sourceId) || selected.has(relation.targetId)).map((relation) => relation.id);
  const annotationIds = sketch.annotations.filter((annotation) => selected.has(annotation.id) || (annotation.targetId && selected.has(annotation.targetId))).map((annotation) => annotation.id);
  const points = [
    ...sketch.assetInstances.filter((asset) => assetInstanceIds.includes(asset.id)).map((asset) => asset.position),
    ...sketch.rawStrokes.filter((stroke) => rawStrokeIds.includes(stroke.id)).flatMap((stroke) => stroke.points.map((point) => ({ x: point.x, y: point.y, time: point.t }))),
    ...sketch.marks.filter((mark) => markIds.includes(mark.id)).flatMap((mark) => mark.points),
  ];

  return {
    id: `UTT-${nanoid(6)}`,
    assetInstanceIds,
    rawStrokeIds,
    gestureCandidateIds,
    markIds,
    relationIds,
    annotationIds,
    bounds: boundsFromPoints(points),
    status: "uninterpreted",
    createdAt: now,
  };
}
