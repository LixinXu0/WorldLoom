import type { LevelVariant, TimelinePoint } from "../types";

export function calculateRealizedTimeline(variant: LevelVariant): TimelinePoint[] {
  const mainEdges = variant.edges.filter((edge) => edge.role === "main");
  const orderedIds = [mainEdges[0]?.from, ...mainEdges.map((edge) => edge.to)].filter((id): id is string => Boolean(id));
  const uniqueIds = Array.from(new Set(orderedIds));
  return uniqueIds.map((id) => {
    const room = variant.rooms.find((item) => item.id === id);
    const pressure = room?.role === "combat" ? Math.max(room.intensity, 0.55) : room?.intensity ?? 0;
    const relief = room?.role === "relief" || room?.role === "reward" ? Math.max(0.5, room.resourceLevel ?? 0.65) : Math.max(0, 0.25 - pressure * 0.1);
    return { id, label: id, pressure: Math.min(1, pressure), relief: Math.min(1, relief), role: room?.role };
  });
}