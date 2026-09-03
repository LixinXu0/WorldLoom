import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { RoomNode } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

const roomFill: Record<RoomNode["role"], string> = { entrance: "#bfe9d3", transition: "#fbfaf6", combat: "#f1bbb5", reward: "#f7dfa3", relief: "#c9ecd7", junction: "#d9cdf9", exit: "#fbfaf6" };
const labelFor = (room: RoomNode): string => room.role === "entrance" ? "ENT" : room.role === "exit" ? "EXIT" : room.id;

export function RoomNodeView({ room, variantId, previewAffected }: { room: RoomNode; variantId: string; previewAffected?: boolean }) {
  const { selected, select, editorSubmode, beginRoomEdit } = useWorldloomStore();
  const isSelected = selected?.kind === "room" && selected.id === room.id && selected.variantId === variantId;
  const editable = editorSubmode === "edit" && room.role !== "entrance" && room.role !== "exit";
  const dragEnd = (event: KonvaEventObject<DragEvent>) => beginRoomEdit(variantId, room.id, { x: event.target.x(), y: event.target.y() }, "position");
  const resize = (corner: "nw" | "ne" | "sw" | "se", event: KonvaEventObject<DragEvent>) => {
    const localX = event.target.x();
    const localY = event.target.y();
    const patch = corner === "se" ? { width: Math.max(30, localX), height: Math.max(26, localY) } : corner === "ne" ? { y: room.y + localY, width: Math.max(30, localX), height: Math.max(26, room.height - localY) } : corner === "sw" ? { x: room.x + localX, width: Math.max(30, room.width - localX), height: Math.max(26, localY) } : { x: room.x + localX, y: room.y + localY, width: Math.max(30, room.width - localX), height: Math.max(26, room.height - localY) };
    beginRoomEdit(variantId, room.id, patch, "size");
  };
  const stroke = previewAffected ? "#f2a93b" : isSelected ? "#2869ff" : room.role === "exit" ? "#171717" : "#444";
  return <Group x={room.x} y={room.y} draggable={editable && !room.locked} onClick={() => select({ kind: "room", variantId, id: room.id })} onDragEnd={dragEnd}>
    <Rect width={room.width} height={room.height} fill={roomFill[room.role]} stroke={stroke} dash={previewAffected ? [5, 4] : []} strokeWidth={isSelected || previewAffected ? 2 : room.role === "exit" ? 2 : 1} />
    {room.locked && <Text x={4} y={3} text="LOCK" fontSize={8} fill="#171717" />}
    {room.intensity > 0.55 && <Line points={[8, 8, room.width - 8, room.height - 8, 8, room.height - 8, room.width - 8, 8]} stroke="#171717" opacity={0.18} strokeWidth={1} />}
    <Text x={6} y={room.height / 2 - 6} width={room.width - 12} align="center" text={labelFor(room)} fontSize={11} fill="#171717" />
    {editable && isSelected && [[0, 0, "nw"], [room.width, 0, "ne"], [0, room.height, "sw"], [room.width, room.height, "se"]].map(([x, y, corner]) => <Circle key={String(corner)} x={Number(x)} y={Number(y)} radius={5} fill="#fbfaf6" stroke="#171717" draggable onDragEnd={(event) => resize(corner as "nw" | "ne" | "sw" | "se", event)} />)}
  </Group>;
}