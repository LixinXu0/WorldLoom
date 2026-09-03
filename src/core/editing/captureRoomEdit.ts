import type { RoomEdit, RoomNode, RoomSnapshot, EditableRoomProperty } from "../types";

export function snapshotRoom(room: RoomNode, variantId: string): RoomSnapshot {
  return {
    roomId: room.id,
    variantId,
    x: room.x,
    y: room.y,
    width: room.width,
    height: room.height,
    role: room.role,
    intensity: room.intensity,
    resourceLevel: room.resourceLevel,
    encounterLevel: room.encounterLevel,
    locked: room.locked,
  };
}

export function roomFromSnapshot(snapshot: RoomSnapshot, base: RoomNode): RoomNode {
  return {
    ...base,
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    role: snapshot.role,
    intensity: snapshot.intensity,
    resourceLevel: snapshot.resourceLevel,
    encounterLevel: snapshot.encounterLevel,
    locked: snapshot.locked,
  };
}

export function captureRoomEdit(id: string, before: RoomNode, after: RoomNode, variantId: string, property: EditableRoomProperty, createdAt: number): RoomEdit {
  return {
    id,
    roomId: before.id,
    variantId,
    property,
    before: snapshotRoom(before, variantId),
    after: snapshotRoom(after, variantId),
    scope: null,
    inferredMeaning: [],
    selectedInterpretationId: null,
    status: "draft",
    createdAt,
  };
}