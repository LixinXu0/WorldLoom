import type { FieldCell, GameplayConstraint, LevelVariant, RoomNode } from "../types";
import type { RandomSource } from "../geometry/seededRandom";
import type { TopologyNode } from "./buildTopology";
import { sampleField } from "../field/sampleField";

export function placeRooms(
  topology: TopologyNode[],
  cells: FieldCell[],
  width: number,
  height: number,
  strategy: LevelVariant["strategy"],
  random: RandomSource,
  constraints: GameplayConstraint[],
): RoomNode[] {
  return topology.map((node, index) => {
    const field = sampleField(cells, node.point, width, height);
    const role = index === 0 ? "entrance" : index === topology.length - 1 ? "exit" : field.relief > 0.55 ? "relief" : field.pressure > 0.38 ? "combat" : "transition";
    const pressureSizePenalty = strategy === "spatial" ? field.pressure * 26 : field.pressure * 8;
    const reliefBonus = strategy === "resource" && role === "relief" ? 12 : 0;
    const size = Math.max(38, 72 - pressureSizePenalty + reliefBonus);
    const jitter = index === 0 || index === topology.length - 1 ? 0 : strategy === "spatial" ? 32 : 18;
    const intensity = Math.min(1, Math.max(0.1, field.pressure * (strategy === "combat" ? 1.25 : 0.9) - field.relief * 0.25));
    const localConstraints = constraints.filter((constraint) => Math.hypot(constraint.region.x - node.point.x, constraint.region.y - node.point.y) < constraint.region.radius + 90);
    return {
      id: index === 0 ? "ENT" : index === topology.length - 1 ? "EXIT" : `${role[0].toUpperCase()}${index}`,
      role,
      x: Math.max(16, Math.min(width - 96, node.point.x - size / 2 + random.range(-jitter, jitter))),
      y: Math.max(16, Math.min(height - 80, node.point.y - size / 2 + random.range(-jitter, jitter))),
      width: size + (strategy === "combat" && role === "combat" ? 18 : 0),
      height: Math.max(34, size * random.range(0.68, 0.95)),
      intensity,
      sourceStrokeIds: Array.from(new Set([...node.sourceStrokeIds, ...localConstraints.flatMap((constraint) => constraint.sourceStrokeIds)])),
      sourceConstraintIds: Array.from(new Set([...node.sourceConstraintIds, ...localConstraints.map((constraint) => constraint.id)])),
    };
  });
}

export function separateRooms(rooms: RoomNode[]): RoomNode[] {
  const result = rooms.map((room) => ({ ...room }));
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i];
        const b = result[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > -8 && overlapY > -8) {
          b.x += b.x > a.x ? 10 : -10;
          b.y += b.y > a.y ? 10 : -10;
        }
      }
    }
  }
  return result;
}
