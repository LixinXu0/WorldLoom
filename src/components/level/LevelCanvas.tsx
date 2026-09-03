import { Layer, Rect, Stage, Text } from "react-konva";
import { calculateRealizedTimeline } from "../../core/timeline/calculateRealizedTimeline";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { ExperienceTimeline } from "../timeline/ExperienceTimeline";
import { RouteEdgeView } from "./RouteEdgeView";
import { RoomNodeView } from "./RoomNodeView";

export function LevelCanvas() {
  const { project, impactPreview } = useWorldloomStore();
  const variant = project.variants.find((item) => item.id === (project.workingVariantId ?? project.activeVariantId)) ?? project.variants[0];
  if (!variant) return <div className="canvas-empty">Generate variants to inspect a whitebox level.</div>;
  const affected = new Set(impactPreview?.affectedRoomIds ?? []);
  return <div className="level-stack"><div className="canvas-frame"><Stage width={project.metadata.canvasWidth} height={project.metadata.canvasHeight}>
    <Layer><Rect x={0} y={0} width={project.metadata.canvasWidth} height={project.metadata.canvasHeight} fill="#f8f5ee" />{variant.edges.map((edge) => <RouteEdgeView key={edge.id} edge={edge} rooms={variant.rooms} />)}{variant.rooms.map((room) => <RoomNodeView key={room.id} room={room} variantId={variant.id} previewAffected={affected.has(room.id)} />)}<Text x={18} y={16} text={`${variant.name} / ${variant.strategy}${project.workingVariantId === variant.id ? " / Working" : ""}`} fontSize={13} fill="#171717" /></Layer>
  </Stage></div><ExperienceTimeline title="Realized" points={calculateRealizedTimeline(variant)} /></div>;
}