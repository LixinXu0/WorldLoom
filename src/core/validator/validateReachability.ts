import type { LevelVariant, RouteEdge, RoomNode, ValidationResult } from "../types";

export function validateReachability(rooms: RoomNode[], edges: RouteEdge[]): ValidationResult {
  const entrance = rooms.find((room) => room.role === "entrance");
  const exit = rooms.find((room) => room.role === "exit");
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!entrance) errors.push("Missing entrance room.");
  if (!exit) errors.push("Missing exit room.");
  if (!entrance || !exit) {
    return { reachable: false, entranceExitConnected: false, optionalBranchCount: 0, deadEnds: [], criticalPathLength: 0, errors, warnings };
  }
  const adjacency = new Map<string, string[]>();
  for (const room of rooms) adjacency.set(room.id, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const queue: Array<{ id: string; depth: number }> = [{ id: entrance.id, depth: 0 }];
  const visited = new Map<string, number>([[entrance.id, 0]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const next of adjacency.get(current.id) ?? []) {
      if (!visited.has(next)) {
        visited.set(next, current.depth + 1);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
  }
  const deadEnds = rooms.filter((room) => room.role !== "exit" && (adjacency.get(room.id) ?? []).length === 0).map((room) => room.id);
  if (deadEnds.length > 0) warnings.push(`Optional dead ends: ${deadEnds.join(", ")}`);
  return {
    reachable: visited.size === rooms.length || visited.has(exit.id),
    entranceExitConnected: visited.has(exit.id),
    optionalBranchCount: edges.filter((edge) => edge.role === "optional").length,
    deadEnds,
    criticalPathLength: visited.get(exit.id) ?? 0,
    errors,
    warnings,
  };
}

export function withValidation(variant: Omit<LevelVariant, "validation">): LevelVariant {
  return { ...variant, validation: validateReachability(variant.rooms, variant.edges) };
}
