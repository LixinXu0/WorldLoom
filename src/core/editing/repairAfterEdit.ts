import type { LevelVariant, RoomNode } from "../types";

function overlaps(a: RoomNode, b: RoomNode): boolean {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > -6 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > -6;
}

export function repairAfterEdit(variant: LevelVariant): LevelVariant {
  const rooms = variant.rooms.map((room) => ({ ...room }));
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < rooms.length; i += 1) {
      for (let j = i + 1; j < rooms.length; j += 1) {
        const a = rooms[i];
        const b = rooms[j];
        if (overlaps(a, b)) {
          const protectedA = a.locked || a.manual;
          const protectedB = b.locked || b.manual;
          const movable = protectedB && !protectedA ? a : b;
          if (movable.locked) continue;
          const directionX = movable.x + movable.width / 2 >= a.x + a.width / 2 ? 1 : -1;
          const directionY = movable.y + movable.height / 2 >= a.y + a.height / 2 ? 1 : -1;
          movable.x = Math.max(16, Math.min(864, movable.x + 12 * directionX));
          movable.y = Math.max(16, Math.min(500, movable.y + 10 * directionY));
        }
      }
    }
  }
  return { ...variant, rooms };
}