import { Line } from "react-konva";
import type { RoomNode, RouteEdge } from "../../core/types";

export function RouteEdgeView({ edge, rooms }: { edge: RouteEdge; rooms: RoomNode[] }) {
  const from = rooms.find((room) => room.id === edge.from);
  const to = rooms.find((room) => room.id === edge.to);
  if (!from || !to) return null;
  const points = [from.x + from.width / 2, from.y + from.height / 2, to.x + to.width / 2, to.y + to.height / 2];
  return <Line points={points} stroke={edge.role === "main" ? "#171717" : "#686868"} strokeWidth={edge.role === "main" ? 5 : 3} dash={edge.role === "main" ? [] : [6, 5]} opacity={0.78} lineCap="square" />;
}
