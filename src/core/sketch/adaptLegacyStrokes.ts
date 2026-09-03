import type { SketchMark, SketchState } from "./types";
import type { Stroke } from "../types";

export function legacyStrokeToSketchMark(stroke: Stroke): SketchMark {
  return {
    id: `mark-${stroke.id}`,
    kind: `legacy-${stroke.type}`,
    points: stroke.points,
    width: stroke.width,
    intensity: stroke.intensity,
    createdAt: stroke.createdAt,
    sourceStrokeId: stroke.id,
  };
}

export function createSketchStateFromStrokes(strokes: Stroke[]): SketchState {
  return { assetInstances: [], rawStrokes: [], gestureCandidates: [], episodes: [], marks: strokes.map(legacyStrokeToSketchMark), objects: [], relations: [], annotations: [], groups: [], utterances: [] };
}

export function emptySketchState(): SketchState {
  return { assetInstances: [], rawStrokes: [], gestureCandidates: [], episodes: [], marks: [], objects: [], relations: [], annotations: [], groups: [], utterances: [] };
}
