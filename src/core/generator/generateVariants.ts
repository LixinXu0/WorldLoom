import type { FieldCell, GameplayConstraint, LevelVariant, Stroke } from "../types";
import { seededRandom } from "../geometry/seededRandom";
import { buildMainPath } from "./buildTopology";
import { placeRooms, separateRooms } from "./placeRooms";
import { buildCorridors } from "./buildCorridors";
import { validateReachability } from "../validator/validateReachability";
import { calculateIntentFit } from "../validator/calculateIntentFit";

const names: Record<LevelVariant["strategy"], string> = {
  spatial: "Variant A",
  combat: "Variant B",
  resource: "Variant C",
};

export function generateVariants(strokes: Stroke[], constraints: GameplayConstraint[], cells: FieldCell[], seed: number, width: number, height: number): LevelVariant[] {
  return (["spatial", "combat", "resource"] as const).map((strategy, index) => {
    const random = seededRandom(seed + index * 9973);
    const topology = buildMainPath(strokes, constraints, width, height);
    const mainRooms = separateRooms(placeRooms(topology, cells, width, height, strategy, random, constraints));
    const { rooms, edges } = buildCorridors(mainRooms, strokes, constraints, cells, width, height, strategy, random);
    const validation = validateReachability(rooms, edges);
    if (!strokes.some((stroke) => stroke.enabled && stroke.type === "flow")) {
      validation.warnings.push("No Flow stroke supplied; generated from default entrance-to-exit path.");
    }
    const intentFitBreakdown = calculateIntentFit({ rooms, edges, strategy }, strokes);
    return { id: `variant-${strategy}`, name: names[strategy], strategy, seed, rooms, edges, validation, intentFit: intentFitBreakdown.total, intentFitBreakdown };
  });
}
