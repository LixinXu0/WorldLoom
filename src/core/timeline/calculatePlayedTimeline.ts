import type { ExperienceFeedback, LevelVariant, PlaytestEvent, TimelinePoint } from "../types";

export function calculatePlayedTimeline(variant: LevelVariant, events: PlaytestEvent[], feedback: ExperienceFeedback[]): TimelinePoint[] {
  const enters = events.filter((event) => event.variantId === variant.id && (event.type === "session-start" || event.type === "room-enter" || event.type === "branch-enter" || event.type === "session-complete") && event.roomId);
  return enters.map((event, index) => {
    const room = variant.rooms.find((item) => item.id === event.roomId);
    return {
      id: `${event.id}-${index}`,
      label: room?.id ?? "?",
      pressure: Math.min(1, event.pressureAtEvent ?? room?.intensity ?? 0),
      relief: Math.min(1, event.reliefAtEvent ?? (room?.role === "relief" ? 0.75 : 0.1)),
      role: room?.role,
      feedbackCategories: feedback.filter((item) => item.roomId === event.roomId).map((item) => item.category),
    };
  });
}