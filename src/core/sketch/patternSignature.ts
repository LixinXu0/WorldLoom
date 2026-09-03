import type { SketchPatternSignature, SketchState } from "./types";

function isClosed(points: Array<{ x: number; y: number }>): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const diagonal = Math.hypot(
    Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
    Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
  );
  return Math.hypot(first.x - last.x, first.y - last.y) < Math.max(24, diagonal * 0.22);
}

export function buildSketchPatternSignature(sketch: SketchState, ids?: string[]): SketchPatternSignature {
  const idSet = ids ? new Set(ids) : null;
  const marks = sketch.marks.filter((mark) => !idSet || idSet.has(mark.id));
  const objects = sketch.objects.filter((object) => !idSet || idSet.has(object.id));
  const assets = sketch.assetInstances.filter((asset) => !idSet || idSet.has(asset.id));
  const relations = sketch.relations.filter((relation) => (!idSet || idSet.has(relation.id) || (idSet.has(relation.sourceId) && idSet.has(relation.targetId))));
  const points = [...marks.flatMap((mark) => mark.points), ...objects.map((object) => object.position), ...assets.map((asset) => asset.position)];
  const width = points.length === 0 ? 1 : Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
  const height = points.length === 0 ? 1 : Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
  return {
    markKinds: marks.map((mark) => mark.kind).sort(),
    objectTypes: [...objects.map((object) => object.objectType), ...assets.map((asset) => `asset:${asset.assetDefinitionId}`)].sort(),
    relationTypes: relations.map((relation) => relation.relationType).sort(),
    markCount: marks.length,
    objectCount: objects.length + assets.length,
    relationCount: relations.length,
    hasClosedRegion: marks.some((mark) => mark.kind === "region" || isClosed(mark.points)),
    hasArrow: marks.some((mark) => mark.kind === "arrow"),
    boundingAspectRatio: Number((width / Math.max(1, height)).toFixed(2)),
    topology: `${marks.length}m-${objects.length + assets.length}o-${relations.length}r-${relations.map((relation) => relation.relationType).sort().join(".")}`,
  };
}

export function compareSketchSignatures(a: SketchPatternSignature, b: SketchPatternSignature): { similarity: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  let max = 0;
  const markOverlap = a.markKinds.filter((kind) => b.markKinds.includes(kind)).length;
  max += 2;
  score += a.markKinds.length === 0 && b.markKinds.length === 0 ? 2 : (2 * markOverlap) / Math.max(1, Math.max(a.markKinds.length, b.markKinds.length));
  if (markOverlap > 0) reasons.push("matching mark kinds");
  const objectOverlap = a.objectTypes.filter((type) => b.objectTypes.includes(type)).length;
  max += 2;
  score += a.objectTypes.length === 0 && b.objectTypes.length === 0 ? 2 : (2 * objectOverlap) / Math.max(1, Math.max(a.objectTypes.length, b.objectTypes.length));
  if (objectOverlap > 0) reasons.push("matching object types");
  const relationOverlap = a.relationTypes.filter((type) => b.relationTypes.includes(type)).length;
  max += 2;
  score += a.relationTypes.length === 0 && b.relationTypes.length === 0 ? 2 : (2 * relationOverlap) / Math.max(1, Math.max(a.relationTypes.length, b.relationTypes.length));
  if (relationOverlap > 0) reasons.push("matching relation topology");
  max += 1;
  if (a.hasClosedRegion === b.hasClosedRegion) {
    score += 1;
    if (a.hasClosedRegion) reasons.push("both include a closed region");
  }
  max += 1;
  if (a.hasArrow === b.hasArrow) {
    score += 1;
    if (a.hasArrow) reasons.push("both include an arrow");
  }
  max += 1;
  const aspectDelta = Math.abs(a.boundingAspectRatio - b.boundingAspectRatio);
  score += Math.max(0, 1 - aspectDelta / 2);
  if (aspectDelta < 0.35) reasons.push("similar bounding-box proportions");
  return { similarity: Number((score / max).toFixed(3)), reasons };
}
