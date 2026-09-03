import type { GameplayConstraint, RoomNode, Stroke } from "../types";

export function buildRoomExplanation(room: RoomNode, strokes: Stroke[], constraints: GameplayConstraint[]): string {
  const strokeNames = room.sourceStrokeIds
    .map((id) => strokes.find((stroke) => stroke.id === id))
    .filter((stroke): stroke is Stroke => Boolean(stroke))
    .map((stroke) => `${stroke.type} stroke ${stroke.id}`);
  const targets = room.sourceConstraintIds
    .map((id) => constraints.find((constraint) => constraint.id === id)?.target)
    .filter((target) => Boolean(target));
  const source = strokeNames.length > 0 ? strokeNames.join(", ") : "the default main path";
  const targetText = targets.length > 0 ? ` It satisfies ${Array.from(new Set(targets)).join(", ")} constraints.` : "";
  return `This ${room.role} room is placed from ${source}.${targetText}`;
}

