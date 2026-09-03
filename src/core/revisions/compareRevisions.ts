import type { DesignRevision, RoomNode } from "../types";

export type RevisionRoomDiff = {
  added: RoomNode[];
  removed: RoomNode[];
  changed: Array<{ before: RoomNode; after: RoomNode }>;
};

export function compareRevisionRooms(previous: DesignRevision, current: DesignRevision): RevisionRoomDiff {
  const previousVariant = previous.projectSnapshot.variants.find((variant) => variant.id === previous.activeVariantId) ?? previous.projectSnapshot.variants[0];
  const currentVariant = current.projectSnapshot.variants.find((variant) => variant.id === current.activeVariantId) ?? current.projectSnapshot.variants[0];
  const previousRooms = previousVariant?.rooms ?? [];
  const currentRooms = currentVariant?.rooms ?? [];
  const prevById = new Map(previousRooms.map((room) => [room.id, room]));
  const curById = new Map(currentRooms.map((room) => [room.id, room]));
  return {
    added: currentRooms.filter((room) => !prevById.has(room.id)),
    removed: previousRooms.filter((room) => !curById.has(room.id)),
    changed: currentRooms.flatMap((room) => {
      const before = prevById.get(room.id);
      if (!before) return [];
      const changed = before.x !== room.x || before.y !== room.y || before.width !== room.width || before.height !== room.height || before.role !== room.role || before.intensity !== room.intensity;
      return changed ? [{ before, after: room }] : [];
    }),
  };
}