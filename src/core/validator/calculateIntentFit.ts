import type { IntentFitBreakdown, LevelVariant, Stroke } from "../types";

export function calculateIntentFit(variant: Pick<LevelVariant, "rooms" | "edges" | "strategy">, strokes: Stroke[]): IntentFitBreakdown {
  const enabled = strokes.filter((stroke) => stroke.enabled);
  const has = (type: Stroke["type"]) => enabled.some((stroke) => stroke.type === type);
  const combatRooms = variant.rooms.filter((room) => room.role === "combat");
  const reliefRooms = variant.rooms.filter((room) => room.role === "relief");
  const flow = has("flow") ? Math.min(100, 58 + variant.rooms.length * 5) : 48;
  const pressure = has("pressure") ? Math.min(100, 45 + combatRooms.length * 12 + (variant.strategy === "combat" ? 12 : 0)) : 70;
  const relief = has("relief") ? Math.min(100, 45 + reliefRooms.length * 18 + (variant.strategy === "resource" ? 8 : 0)) : 70;
  const branch = has("branch") ? Math.min(100, 42 + variant.edges.filter((edge) => edge.role === "optional").length * 18) : 70;
  const total = Math.round(flow * 0.3 + pressure * 0.25 + relief * 0.2 + branch * 0.25);
  return { flow: Math.round(flow), pressure: Math.round(pressure), relief: Math.round(relief), branch: Math.round(branch), total };
}
