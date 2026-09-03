import { useMemo, useState } from "react";
import { Layer, Line, Rect, Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Point, StrokeType } from "../../core/types";
import { FIELD_COLUMNS, FIELD_ROWS, buildExperienceField } from "../../core/field/buildExperienceField";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { ExperienceFieldLayer } from "./ExperienceFieldLayer";
import { StrokeLayer } from "./StrokeLayer";
import { AnchorLayer } from "./AnchorLayer";

const drawable = (tool: string): tool is StrokeType => tool === "flow" || tool === "pressure" || tool === "relief" || tool === "branch";

export function IntentCanvas() {
  const { project, activeTool, addStroke, eraseAt, showField } = useWorldloomStore();
  const [draft, setDraft] = useState<Point[]>([]);
  const cells = useMemo(() => buildExperienceField(project.strokes, project.metadata.canvasWidth, project.metadata.canvasHeight), [project.strokes, project.metadata.canvasWidth, project.metadata.canvasHeight]);
  const pointFromEvent = (event: KonvaEventObject<PointerEvent>): Point | null => {
    const pos = event.target.getStage()?.getPointerPosition();
    return pos ? { x: pos.x, y: pos.y, pressure: event.evt.pressure, time: performance.now() } : null;
  };
  const down = (event: KonvaEventObject<PointerEvent>) => {
    const point = pointFromEvent(event);
    if (!point) return;
    if (activeTool === "eraser") eraseAt(point);
    if (drawable(activeTool)) setDraft([point]);
  };
  const move = (event: KonvaEventObject<PointerEvent>) => {
    const point = pointFromEvent(event);
    if (!point || draft.length === 0 || !drawable(activeTool)) return;
    const last = draft[draft.length - 1];
    if (Math.hypot(last.x - point.x, last.y - point.y) >= 3) setDraft([...draft, point]);
  };
  const up = () => {
    if (draft.length > 1 && drawable(activeTool)) addStroke(activeTool, draft);
    setDraft([]);
  };
  return <div className="canvas-frame"><Stage width={project.metadata.canvasWidth} height={project.metadata.canvasHeight} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
    <Layer><Rect x={0} y={0} width={project.metadata.canvasWidth} height={project.metadata.canvasHeight} fill="#f4f1ea" />{Array.from({ length: 25 }).map((_, i) => <Line key={`v-${i}`} points={[i * 40, 0, i * 40, project.metadata.canvasHeight]} stroke="#d8d4cb" opacity={0.45} strokeWidth={1} />)}{Array.from({ length: 15 }).map((_, i) => <Line key={`h-${i}`} points={[0, i * 40, project.metadata.canvasWidth, i * 40]} stroke="#d8d4cb" opacity={0.45} strokeWidth={1} />)}</Layer>
    <Layer>{showField && <ExperienceFieldLayer cells={cells} cellWidth={project.metadata.canvasWidth / FIELD_COLUMNS} cellHeight={project.metadata.canvasHeight / FIELD_ROWS} />}</Layer>
    <Layer><StrokeLayer strokes={project.strokes} />{draft.length > 1 && <Line points={draft.flatMap((point) => [point.x, point.y])} stroke="#171717" strokeWidth={2} opacity={0.5} lineCap="round" lineJoin="round" />}<AnchorLayer width={project.metadata.canvasWidth} height={project.metadata.canvasHeight} /></Layer>
  </Stage></div>;
}
