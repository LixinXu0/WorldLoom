import { nanoid } from "nanoid";
import type { ExperienceFeedback, LevelVariant, PlaytestEvent, PlaytestSession, RoomNode } from "../types";

export function createPlaytestSession(variant: LevelVariant, now: number): { session: PlaytestSession; event: PlaytestEvent } {
  const entrance = variant.rooms.find((room) => room.role === "entrance") ?? variant.rooms[0];
  const session: PlaytestSession = { id: `PT-${nanoid(5)}`, variantId: variant.id, startedAt: now, completedAt: null, currentRoomId: entrance?.id ?? null, visitedRoomIds: entrance ? [entrance.id] : [] };
  const event: PlaytestEvent = { id: `PE-${nanoid(5)}`, sessionId: session.id, variantId: variant.id, type: "session-start", roomId: entrance?.id, timestamp: now, elapsedMs: 0, pressureAtEvent: entrance?.intensity, reliefAtEvent: entrance?.role === "relief" ? 0.8 : 0.1 };
  return { session, event };
}

export function adjacentRooms(variant: LevelVariant, roomId: string): RoomNode[] {
  const nextIds = variant.edges.filter((edge) => edge.from === roomId || edge.to === roomId).map((edge) => edge.from === roomId ? edge.to : edge.from);
  return nextIds.map((id) => variant.rooms.find((room) => room.id === id)).filter((room): room is RoomNode => Boolean(room));
}

export function enterRoom(session: PlaytestSession, variant: LevelVariant, roomId: string, now: number): { session: PlaytestSession; event: PlaytestEvent } {
  const room = variant.rooms.find((item) => item.id === roomId);
  const edge = variant.edges.find((item) => (item.from === session.currentRoomId && item.to === roomId) || (item.to === session.currentRoomId && item.from === roomId));
  const completed = room?.role === "exit";
  const nextSession: PlaytestSession = { ...session, currentRoomId: roomId, completedAt: completed ? now : session.completedAt, visitedRoomIds: [...session.visitedRoomIds, roomId] };
  return {
    session: nextSession,
    event: { id: `PE-${nanoid(5)}`, sessionId: session.id, variantId: variant.id, type: completed ? "session-complete" : edge?.role === "optional" ? "branch-enter" : "room-enter", roomId, edgeId: edge?.id, timestamp: now, elapsedMs: now - session.startedAt, pressureAtEvent: room?.intensity, reliefAtEvent: room?.role === "relief" ? 0.8 : room?.role === "reward" ? 0.55 : 0.08 },
  };
}

export function createFeedback(session: PlaytestSession, variantId: string, category: ExperienceFeedback["category"], note: string | undefined, now: number): ExperienceFeedback {
  return { id: `FB-${nanoid(5)}`, sessionId: session.id, variantId, roomId: session.currentRoomId, edgeId: null, category, note, timestamp: now };
}