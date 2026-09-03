import { Arrow, Line } from "react-konva";
import type { Stroke } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

const colors: Record<Stroke["type"], string> = { flow: "#2869ff", pressure: "#e24a3b", relief: "#28a56a", branch: "#8a5cf5" };

export function StrokeLayer({ strokes }: { strokes: Stroke[] }) {
  const { selected, select } = useWorldloomStore();
  return <>{strokes.filter((stroke) => stroke.enabled).map((stroke) => {
    const points = stroke.points.flatMap((point) => [point.x, point.y]);
    const selectedStroke = selected?.kind === "stroke" && selected.id === stroke.id;
    const common = { points, stroke: colors[stroke.type], strokeWidth: stroke.width, opacity: stroke.type === "flow" ? 0.9 : 0.45, lineCap: "round" as const, lineJoin: "round" as const, onClick: () => select({ kind: "stroke", id: stroke.id }) };
    if (stroke.type === "flow" && stroke.points.length > 1) {
      return <Arrow key={stroke.id} {...common} pointerLength={10} pointerWidth={10} shadowColor={selectedStroke ? "#171717" : undefined} shadowBlur={selectedStroke ? 4 : 0} />;
    }
    return <Line key={stroke.id} {...common} shadowColor={selectedStroke ? "#171717" : undefined} shadowBlur={selectedStroke ? 4 : 0} />;
  })}</>;
}
