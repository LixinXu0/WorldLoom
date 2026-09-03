import type { ExperienceFeedback, ProposedChange, RoomNode } from "../types";

export function feedbackToSuggestions(feedback: ExperienceFeedback, room: RoomNode | undefined): ProposedChange[] {
  if (!room) return [];
  if (feedback.category === "too-intense") return [
    { entityType: "room", entityId: room.id, property: "intensity", before: room.intensity, after: Math.max(0.1, room.intensity - 0.18) },
    { entityType: "room", entityId: room.id, property: "width", before: room.width, after: room.width + 14 },
  ];
  if (feedback.category === "too-calm") return [{ entityType: "room", entityId: room.id, property: "intensity", before: room.intensity, after: Math.min(1, room.intensity + 0.16) }];
  if (feedback.category === "too-long") return [{ entityType: "edge", entityId: room.id, property: "pathLength", before: "long", after: "shorter" }];
  if (feedback.category === "weak-branch") return [{ entityType: "variant-rule", entityId: room.id, property: "branchLength", before: "shallow", after: "deeper" }];
  return [{ entityType: "room", entityId: room.id, property: "moment", before: "unmarked", after: feedback.category }];
}