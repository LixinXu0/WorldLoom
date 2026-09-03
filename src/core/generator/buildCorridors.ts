import type { FieldCell, GameplayConstraint, LevelVariant, RoomNode, RouteEdge, Stroke } from "../types";
import { sampleField } from "../field/sampleField";
import type { RandomSource } from "../geometry/seededRandom";

export function buildCorridors(
  rooms: RoomNode[],
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  cells: FieldCell[],
  width: number,
  height: number,
  strategy: LevelVariant["strategy"],
  random: RandomSource,
): { rooms: RoomNode[]; edges: RouteEdge[] } {
  const edges: RouteEdge[] = [];
  for (let i = 1; i < rooms.length; i += 1) {
    edges.push({
      id: `E${i}`,
      from: rooms[i - 1].id,
      to: rooms[i].id,
      role: "main",
      risk: (rooms[i - 1].intensity + rooms[i].intensity) / 2,
      sourceStrokeIds: Array.from(new Set([...rooms[i - 1].sourceStrokeIds, ...rooms[i].sourceStrokeIds])),
      sourceConstraintIds: Array.from(new Set([...rooms[i - 1].sourceConstraintIds, ...rooms[i].sourceConstraintIds])),
    });
  }
  const branchStrokes = strokes.filter((stroke) => stroke.enabled && stroke.type === "branch");
  const addedRooms = [...rooms];
  const branchConstraintIds = constraints.filter((constraint) => constraint.target === "branching").map((constraint) => constraint.id);
  branchStrokes.forEach((stroke, index) => {
    const anchorIndex = Math.max(1, Math.min(rooms.length - 2, Math.floor(random.range(1, rooms.length - 1))));
    const anchor = rooms[anchorIndex];
    const field = sampleField(cells, { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }, width, height);
    const reward = strategy === "resource" || field.relief > 0.4;
    const branchCount = strategy === "combat" ? 2 : 1;
    let previous = anchor;
    for (let step = 0; step < branchCount; step += 1) {
      const branchRoom: RoomNode = {
        id: `${reward ? "R" : "C"}B${index + 1}-${step + 1}`,
        role: reward && step === branchCount - 1 ? "reward" : "combat",
        x: Math.max(20, Math.min(width - 90, anchor.x + random.range(70, 160))),
        y: Math.max(20, Math.min(height - 70, anchor.y + random.range(step === 0 ? -110 : 45, step === 0 ? -45 : 120))),
        width: reward ? 64 : 58,
        height: reward ? 44 : 50,
        intensity: reward ? 0.2 : Math.max(0.5, field.pressure),
        sourceStrokeIds: [stroke.id],
        sourceConstraintIds: branchConstraintIds,
      };
      addedRooms.push(branchRoom);
      edges.push({ id: `B${index + 1}-${step + 1}`, from: previous.id, to: branchRoom.id, role: "optional", risk: branchRoom.intensity, sourceStrokeIds: [stroke.id], sourceConstraintIds: branchConstraintIds });
      previous = branchRoom;
    }
    const rejoins = strategy === "spatial" || random.next() > 0.25;
    if (rejoins) {
      const target = rooms[Math.min(rooms.length - 1, anchorIndex + 1)];
      edges.push({ id: `BR${index + 1}`, from: previous.id, to: target.id, role: "return", risk: 0.25, sourceStrokeIds: [stroke.id], sourceConstraintIds: branchConstraintIds });
    }
  });
  return { rooms: addedRooms, edges };
}
